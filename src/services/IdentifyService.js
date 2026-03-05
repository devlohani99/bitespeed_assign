const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class IdentifyService {
    async identifyContact(email, phoneNumber) {
        const phoneStr = phoneNumber ? String(phoneNumber) : null;
        const emailStr = email ? String(email) : null;

        if (!emailStr && !phoneStr) {
            throw new Error("Email or phoneNumber is required");
        }

        // 1. Find directly matching contacts
        const matchingContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    ...(emailStr ? [{ email: emailStr }] : []),
                    ...(phoneStr ? [{ phoneNumber: phoneStr }] : [])
                ]
            }
        });

        if (matchingContacts.length === 0) {
            return this._createNewPrimary(emailStr, phoneStr);
        }

        // 2. Identify all related contacts (the entire cluster)
        let primaryIds = new Set();
        for (const c of matchingContacts) {
            if (c.linkPrecedence === 'primary') {
                primaryIds.add(c.id);
            } else {
                primaryIds.add(c.linkedId);
            }
        }

        let allContacts = await prisma.contact.findMany({
            where: {
                OR: Array.from(primaryIds).flatMap(id => [
                    { id: id },
                    { linkedId: id }
                ])
            },
            orderBy: { createdAt: 'asc' }
        });

        // We might have multiple primary contacts if this request links them!
        const primaries = allContacts.filter(c => c.linkPrecedence === 'primary');
        primaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        let mainPrimary = primaries[0];

        // If there is more than 1 primary, merge them
        if (primaries.length > 1) {
            allContacts = await this._mergePrimaries(primaries, mainPrimary);
        }

        // 3. Check if we need to add a new secondary contact
        const clusterEmails = new Set(allContacts.map(c => c.email).filter(Boolean));
        const clusterPhones = new Set(allContacts.map(c => c.phoneNumber).filter(Boolean));

        if (
            (emailStr && !clusterEmails.has(emailStr)) ||
            (phoneStr && !clusterPhones.has(phoneStr))
        ) {
            const newSecondary = await this._createNewSecondary(emailStr, phoneStr, mainPrimary.id);
            allContacts.push(newSecondary);
        }

        // 4. Construct response
        return this._buildResponse(mainPrimary, allContacts);
    }

    async _createNewPrimary(emailStr, phoneStr) {
        const newContact = await prisma.contact.create({
            data: {
                email: emailStr,
                phoneNumber: phoneStr,
                linkPrecedence: 'primary'
            }
        });
        return {
            contact: {
                primaryContatctId: newContact.id,
                emails: newContact.email ? [newContact.email] : [],
                phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                secondaryContactIds: []
            }
        };
    }

    async _mergePrimaries(primaries, mainPrimary) {
        for (let i = 1; i < primaries.length; i++) {
            const secondaryPrimary = primaries[i];
            await prisma.contact.update({
                where: { id: secondaryPrimary.id },
                data: {
                    linkPrecedence: 'secondary',
                    linkedId: mainPrimary.id,
                    updatedAt: new Date()
                }
            });
            // Update its children too
            await prisma.contact.updateMany({
                where: { linkedId: secondaryPrimary.id },
                data: {
                    linkedId: mainPrimary.id,
                    updatedAt: new Date()
                }
            });
        }
        // Re-fetch all contacts after merge
        return await prisma.contact.findMany({
            where: {
                OR: [
                    { id: mainPrimary.id },
                    { linkedId: mainPrimary.id }
                ]
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    async _createNewSecondary(emailStr, phoneStr, mainPrimaryId) {
        return await prisma.contact.create({
            data: {
                email: emailStr,
                phoneNumber: phoneStr,
                linkedId: mainPrimaryId,
                linkPrecedence: 'secondary'
            }
        });
    }

    _buildResponse(mainPrimary, allContacts) {
        const emails = [];
        if (mainPrimary.email) emails.push(mainPrimary.email);
        for (const c of allContacts) {
            if (c.email && c.email !== mainPrimary.email && !emails.includes(c.email)) {
                emails.push(c.email);
            }
        }

        const phones = [];
        if (mainPrimary.phoneNumber) phones.push(mainPrimary.phoneNumber);
        for (const c of allContacts) {
            if (c.phoneNumber && c.phoneNumber !== mainPrimary.phoneNumber && !phones.includes(c.phoneNumber)) {
                phones.push(c.phoneNumber);
            }
        }

        const secondaryIds = allContacts
            .filter(c => c.id !== mainPrimary.id)
            .map(c => c.id);

        return {
            contact: {
                primaryContatctId: mainPrimary.id,
                emails: emails,
                phoneNumbers: phones,
                secondaryContactIds: secondaryIds
            }
        };
    }
}

module.exports = new IdentifyService();
