// ============================================================================
// TOOLBOX SETUP
// Just like 'Import-Module' in PowerShell, we are bringing in a Microsoft tool.
// This specific tool allows our code to securely log into Azure without passwords.
// ============================================================================
const { ManagedIdentityCredential } = require("@azure/identity");

// ============================================================================
// MAIN FUNCTION ENGINE
// This is the starting line. When the dashboard clicks "Revoke", Azure runs this.
// 'async' means this script will need to pause and wait for the internet to respond.
// 'context' lets us write logs. 'req' (Request) holds the data sent from the dashboard.
// ============================================================================
module.exports = async function (context, req) {
    context.log('Execution Triggered: Someone clicked the Revoke button.');

    // ------------------------------------------------------------------------
    // STEP 1: Catch the data thrown by the dashboard
    // We look inside the request body to see who we are firing, and from what app.
    // ------------------------------------------------------------------------
    const targetUsername = req.body.username;
    const targetApplication = req.body.application;

    // Safety Check: If the dashboard sent blank data, stop the script immediately.
    if (targetUsername == null || targetApplication == null) {
        context.res = { status: 400, body: "Error: Missing username or application." };
        return; // 'return' acts like 'Exit' in PowerShell. It kills the script here.
    }

    // ------------------------------------------------------------------------
    // STEP 2: The Mapping Dictionary (Matching names to Entra ID codes)
    // Microsoft Graph doesn't understand "visio.exe". It only understands 
    // long, ugly Object IDs. We create a dictionary to translate them.
    // ------------------------------------------------------------------------
    const myEntraIdGroups = {
        "visio.exe": "YOUR-VISIO-GROUP-OBJECT-ID-HERE",
        "chrome.exe": "YOUR-CHROME-GROUP-OBJECT-ID-HERE", 
        "comet.exe": "YOUR-COMET-GROUP-OBJECT-ID-HERE" 
    };

    // We look up the app name in our dictionary to get the correct Object ID.
    // We use .toLowerCase() just in case the dashboard sent "Visio.exe" with a capital V.
    const groupObjectId = myEntraIdGroups[targetApplication.toLowerCase()];

    // Safety Check: If the app isn't in our dictionary, stop the script.
    if (groupObjectId == null) {
        context.res = { status: 400, body: "Error: I do not have a group ID for " + targetApplication };
        return;
    }

    // ------------------------------------------------------------------------
    // STEP 3: The Danger Zone (Talking to Microsoft Graph API)
    // We wrap this in a 'try / catch' block. If anything crashes while talking
    // to Microsoft, the script jumps down to the 'catch' section instead of dying.
    // ------------------------------------------------------------------------
    try {
        
        // --- ACTION A: Get the VIP Security Badge ---
        const mySecurityTool = new ManagedIdentityCredential();
        // We explicitly ask Azure for a badge that works on "graph.microsoft.com"
        const tokenResponse = await mySecurityTool.getToken("https://graph.microsoft.com/.default");
        const myAccessToken = tokenResponse.token;

        // --- ACTION B: Find the User's secret Entra ID ---
        // We write the URL to search Entra ID for the username (e.g., Anish)
        const urlToSearchForUser = `https://graph.microsoft.com/v1.0/users?$filter=startsWith(userPrincipalName, '${targetUsername}')`;
        
        // We 'fetch' (download) the search results, showing our VIP badge at the door
        const searchResponse = await fetch(urlToSearchForUser, { 
            headers: { 'Authorization': `Bearer ${myAccessToken}` } 
        });
        
        // We translate the messy internet response into clean JSON data
        const cleanUserData = await searchResponse.json();
        
        // Safety Check: Did Entra ID find the user?
        // Safety Check: Did Entra ID find the user? (And did Graph block us?)
        if (!cleanUserData.value || cleanUserData.value.length === 0) {
             context.log.error("Graph API Response:", cleanUserData); // This prints the actual error!
             context.res = { status: 400, body: "User not found or Access Denied by Graph." };
             return;
        }
        
        // Grab the exact Object ID of the user we found
        const targetUserId = cleanUserData.value[0].id;

        // --- ACTION C: Fire the User from the Group ---
        // We build the exact URL command to delete a user from a group
        const urlToRemoveUser = `https://graph.microsoft.com/v1.0/groups/${groupObjectId}/members/${targetUserId}/$ref`;
        
        // We 'fetch' the URL, but use the 'DELETE' method instead of downloading
        const removeAction = await fetch(urlToRemoveUser, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${myAccessToken}` }
        });

        // --- ACTION D: Check if it worked ---
        // 204 is Microsoft's secret code for "Deleted Successfully"
        if (removeAction.ok || removeAction.status === 204) {
            context.log("Success! Removed " + targetUsername + " from " + targetApplication);
            context.res = { status: 200, body: "Revocation successful." }; // 200 = OK
        } else {
            // If Microsoft said no, we throw an error to trigger the 'catch' block
            throw new Error("Microsoft Graph rejected the delete command.");
        }

    // ------------------------------------------------------------------------
    // STEP 4: The Safety Net
    // If ANY of the 'await' commands in Step 3 fail, the code drops down to here.
    // ------------------------------------------------------------------------
    } catch (error) {
        context.log.error("Something broke:", error);
        context.res = { status: 500, body: "Internal Server Error. Check the logs." }; // 500 = Server Crash
    }
};
