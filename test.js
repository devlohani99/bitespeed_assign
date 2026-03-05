const runTests = async () => {
    const fetch = (await import('node-fetch')).default || globalThis.fetch;

    const makeReq = async (body, step) => {
        console.log(`\n--- Step ${step} ---`);
        console.log("Request:", body);
        const res = await fetch('http://localhost:3000/identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    };

    // 1. Create Lorraine
    await makeReq({ email: "lorraine@hillvalley.edu", phoneNumber: "123456" }, 1);

    // 2. Create McFly (secondary)
    await makeReq({ email: "mcfly@hillvalley.edu", phoneNumber: "123456" }, 2);

    // 3. Create George (new primary)
    await makeReq({ email: "george@hillvalley.edu", phoneNumber: "919191" }, 3);

    // 4. Create Biff (new primary)
    await makeReq({ email: "biffsucks@hillvalley.edu", phoneNumber: "717171" }, 4);

    // 5. Link George and Biff
    await makeReq({ email: "george@hillvalley.edu", phoneNumber: "717171" }, 5);

    // 6. Test fetching existing with NO new info
    await makeReq({ email: "mcfly@hillvalley.edu", phoneNumber: "123456" }, 6);
    await makeReq({ email: "lorraine@hillvalley.edu", phoneNumber: null }, 7);

    console.log("\nDone Tests.");
};

runTests();
