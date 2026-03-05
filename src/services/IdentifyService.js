const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Separation of Concerns: We extract the raw database operations into their own class (Repository Pattern).
// This follows the Single Responsibility Principle.
class ContactRepository {
    async findMatchingContacts(email, phone) {
        return prisma.contact.findMany({
            where: {
                OR: [
                    ...(email ? [{ email }] : []),
                    ...(phone ? [{ phoneNumber: phone }] : [])
                ]
            }
        });
    }

    async findContactsByPrimaryIds(primaryIds) {
        return prisma.contact.findMany({
            where: {
                OR: Array.from(primaryIds).flatMap(id => [
                    { id: id },
                    { linkedId: id }
                ])
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    async createPrimaryContact(email, phone) {
        return prisma.contact.create({
            data: {
                email,
                phoneNumber: phone,
                linkPrecedence: 'primary'
            }
        });
    }

    async createSecondaryContact(email, phone, linkedId) {
        return prisma.contact.create({
            data: {
                email,
                phoneNumber: phone,
                linkedId,
                linkPrecedence: 'secondary'
            }
        });
    }

    async demotePrimaryToSecondary(contactId, newPrimaryId) {
        await prisma.contact.update({
            where: { id: contactId },
            data: {
                linkPrecedence: 'secondary',
                linkedId: newPrimaryId,
                updatedAt: new Date()
            }
        });

        // Also update any children that were previously linked to this demoted primary
        await prisma.contact.updateMany({
            where: { linkedId: contactId },
            data: {
                linkedId: newPrimaryId,
                updatedAt: new Date()
            }
        });
    }
}

// Business Logic Layer
class IdentifyService {
    constructor() {
        this.repository = new ContactRepository();
    }

    async identifyContact(email, phoneNumber) {
        const phoneStr = phoneNumber ? String(phoneNumber) : null;
        const emailStr = email ? String(email) : null;

        if (!emailStr && !phoneStr) {
            throw new Error("Email or phoneNumber is required");
        }

        const matchingContacts = await this.repository.findMatchingContacts(emailStr, phoneStr);

        // Case 1: Brand new customer
        if (matchingContacts.length === 0) {
            const newContact = await this.repository.createPrimaryContact(emailStr, phoneStr);
            return this._formatConsolidatedResponse(newContact, []);
        }

        // Case 2: Existing customer(s). We need to fetch their entire cluster.
        const clusterIds = this._extractPrimaryIds(matchingContacts);
        let allContacts = await this.repository.findContactsByPrimaryIds(clusterIds);

        // Sort primaries so the oldest is designated as the 'main' primary
        const primaryContacts = allContacts.filter(c => c.linkPrecedence === 'primary');
        primaryContacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const mainPrimary = primaryContacts[0];

        // If multiple primaries matched, we are linking two previously separate accounts
        if (primaryContacts.length > 1) {
            await this._mergeAccounts(primaryContacts, mainPrimary);

            // Re-fetch the cluster to ensure we have the updated state after the merge
            const updatedIds = new Set([mainPrimary.id]);
            allContacts = await this.repository.findContactsByPrimaryIds(updatedIds);
        }

        // Check if the current request introduces completely new contact info into this cluster
        const isNewEmail = emailStr && !allContacts.some(c => c.email === emailStr);
        const isNewPhone = phoneStr && !allContacts.some(c => c.phoneNumber === phoneStr);

        if (isNewEmail || isNewPhone) {
            const newSecondary = await this.repository.createSecondaryContact(emailStr, phoneStr, mainPrimary.id);
            allContacts.push(newSecondary);
        }

        return this._formatConsolidatedResponse(mainPrimary, allContacts);
    }

    // Helper functions

    _extractPrimaryIds(contacts) {
        const primaryIds = new Set();
        for (const contact of contacts) {
            primaryIds.add(contact.linkPrecedence === 'primary' ? contact.id : contact.linkedId);
        }
        return primaryIds;
    }

    async _mergeAccounts(primaryContacts, mainPrimary) {
        // Skip the first one (mainPrimary), demote the rest
        for (let i = 1; i < primaryContacts.length; i++) {
            const secondaryPrimary = primaryContacts[i];
            await this.repository.demotePrimaryToSecondary(secondaryPrimary.id, mainPrimary.id);
        }
    }

    _formatConsolidatedResponse(mainPrimary, allContactsInCluster) {
        // A single primary contact might not have an existing cluster array yet
        const contacts = allContactsInCluster.length > 0 ? allContactsInCluster : [mainPrimary];

        // Use Sets to easily ensure unique emails/phones
        const uniqueEmails = new Set();
        const uniquePhones = new Set();
        const secondaryIds = [];

        // Always put the primary's contact info first
        if (mainPrimary.email) uniqueEmails.add(mainPrimary.email);
        if (mainPrimary.phoneNumber) uniquePhones.add(mainPrimary.phoneNumber);

        for (const contact of contacts) {
            if (contact.email) uniqueEmails.add(contact.email);
            if (contact.phoneNumber) uniquePhones.add(contact.phoneNumber);

            if (contact.id !== mainPrimary.id) {
                secondaryIds.push(contact.id);
            }
        }

        return {
            contact: {
                primaryContatctId: mainPrimary.id,
                emails: Array.from(uniqueEmails),
                phoneNumbers: Array.from(uniquePhones),
                secondaryContactIds: secondaryIds
            }
        };
    }
}

module.exports = new IdentifyService();
