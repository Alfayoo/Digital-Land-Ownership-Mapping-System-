// dloms_project/backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true, // Ensures no two users have the same username
        trim: true, // Removes whitespace from beginning/end
        minlength: 3 // Minimum length for username
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6 // Minimum length for password (for basic security)
    },
    role: {
        type: String,
        enum: ['field_officer', 'admin', 'verifier'], // Predefined roles
        default: 'field_officer' // Default role for new users
    },
    email: {
        type: String,
        trim: true,
        lowercase: true, // Stores emails in lowercase for consistency
        unique: true, // Ensures no two users have the same email
        required: [true, 'Email is required'],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'] // Basic email regex validation
    }
}, {
    timestamps: true // Mongoose automatically adds `createdAt` and `updatedAt` fields
});

// --- Mongoose Middleware (Hooks) ---
// This runs BEFORE a document is saved to the database.
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10); // 10 rounds of salting
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// --- Instance Methods ---
// Custom method to compare an entered password with the stored hashed password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);