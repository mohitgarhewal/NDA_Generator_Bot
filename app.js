const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// In-memory session tracking
const userSessions = {};

// Twilio Credentials (Replace with your actual credentials)
const accountSid = "AC7302bd9281c1eafa8eac9a977bc22958";
const authToken = "603582207dc8f18ee0091c693328d9c4";
const client = twilio(accountSid, authToken);

app.get("/", async(req, res) => {
    res.send("Hello! This is the Twilio WhatsApp NDA Bot. Send 'Hy' to start.");    
});

// Webhook for incoming WhatsApp messages
app.post("/whatsapp",async (req, res) => {
    const twiml = new MessagingResponse();
    const from = req.body.From; // User's WhatsApp number
    const message = req.body.Body.trim(); // User's message

    console.log(`Received message from ${from}: ${message}`);

    // Initialize session if not present
    if (!userSessions[from]) {
        userSessions[from] = { step: 0, data: {} };
    }
    const session = userSessions[from];

    console.log(`Current session step: ${session.step}`);
    

    try {
        // Step 0: Start NDA process when user sends "Hy"
        if (session.step === 0 && message.toLowerCase() === "hy") {
            console.log('User initiated NDA process.');
            
            const reponse = await twiml.message("Hello! Do you want to create an NDA? Reply 'Yes' to proceed.");
            console.log('User asked to create NDA.');
            console.log(`Response: ${reponse}`);
            
            
            session.step = 1;
        } 
        else if (session.step === 1) {
            if (message.toLowerCase() === "yes") {
                console.log('User agreed to proceed with NDA creation.');
                
                twiml.message("Great! Let's begin. Please enter 'Party 1 Name':");
                session.step = 2;
            } else {
                twiml.message("Invalid response. Reply 'Yes' to proceed or restart with 'Hy'.");
            }
        } 
        else if (session.step === 2) {
            console.log(`User entered Party 1 Name: ${message}`);
            
            if (message.match(/^[a-zA-Z ]+$/)) {
                session.data.party1 = message;
                twiml.message("Now, please enter 'Party 2 Name':");
                session.step = 3;
            } else {
                twiml.message("Invalid input. Please enter a valid name (alphabets only).");
            }
        } 
        else if (session.step === 3) {
            if (message.match(/^[a-zA-Z ]+$/)) {
                session.data.party2 = message;
                twiml.message("Enter the 'Agreement Date' (YYYY-MM-DD):");
                session.step = 4;
            } else {
                twiml.message("Invalid input. Please enter a valid name (alphabets only).");
            }
        } 
        else if (session.step === 4) {
            if (message.match(/^\d{4}-\d{2}-\d{2}$/)) {
                session.data.agreementDate = message;
                twiml.message("Describe the 'Confidentiality Terms':");
                session.step = 5;
            } else {
                twiml.message("Invalid date format. Please enter the date as YYYY-MM-DD.");
            }
        } 
        else if (session.step === 5) {
            if (message.length > 10) { // Ensures meaningful input
                session.data.confidentialityTerms = message;
                twiml.message("Enter 'Duration of Agreement' (e.g., 2 years):");
                session.step = 6;
            } else {
                twiml.message("Confidentiality terms must be at least 10 characters long.");
            }
        } 
        else if (session.step === 6) {
            if (message.match(/^\d+ (year|years|month|months)$/)) {
                session.data.duration = message;
                twiml.message("Optional: Enter 'Governing Law' (or type 'Skip' to continue):");
                session.step = 7;
            } else {
                twiml.message("Invalid input. Enter duration in format '2 years' or '6 months'.");
            }
        } 
        else if (session.step === 7) {
            if (message.toLowerCase() !== "skip") {
                session.data.governingLaw = message;
            } else {
                session.data.governingLaw = "Not specified";
            }

            twiml.message(
                `✅ NDA Details Captured!\n\nParty 1: ${session.data.party1}\nParty 2: ${session.data.party2}\nDate: ${session.data.agreementDate}\nTerms: ${session.data.confidentialityTerms}\nDuration: ${session.data.duration}\nGoverning Law: ${session.data.governingLaw}\n\nReply 'Confirm' to finalize.`
            );
            session.step = 8;
        } 
        else if (session.step === 8) {
            if (message.toLowerCase() === "confirm") {
                twiml.message("🎉 Your NDA has been created successfully! ✅");
                delete userSessions[from]; // Reset session
            } else {
                twiml.message("NDA creation canceled. Reply 'Hy' to start over.");
                session.step = 0;
            }
        } 
        else {
            twiml.message("Invalid response. Please follow the instructions step by step.");
        }
    } catch (error) {
        console.error("Error processing WhatsApp message:", error);
        twiml.message("An error occurred. Please try again later.");
    }

    console.log(`Sending response to ${from}: ${twiml.toString()}`);
    

    res.type("text/xml").send(twiml.toString());
});

// Start Express Server
app.listen(3000, () => {
    console.log("Express server listening on port 3000");
});
