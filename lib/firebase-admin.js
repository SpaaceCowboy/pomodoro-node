{/* const admin = require('firebase-admin')
require('dotenv').config();

// Check if all required Firebase credentials are present
const hasFirebaseCredentials = 
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_CLIENT_ID;

let auth = null;
let firebaseInitialized = false;

if (hasFirebaseCredentials) {
    const serviceAccount = {
        type: "service account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    }

    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            })
            auth = admin.auth()
            firebaseInitialized = true
            console.log('Firebase Admin initialized successfully')
        } catch (error) {
            console.error('Firebase Admin initialization error:', error.message)
        }
    } else {
        auth = admin.auth()
        firebaseInitialized = true
    }
} else {
    console.warn('Firebase Admin credentials not found. Firebase features will be disabled.')
    console.warn('Required environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID')
}

module.exports = { auth, admin, firebaseInitialized }  */}