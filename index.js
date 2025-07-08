const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, getDB } = require('./config/db');
const { ObjectId } = require('mongodb'); // Make sure to import this

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Start Server
const startServer = async () => {
    try {
        await connectDB();
        const db = getDB();


        // This is cupone management part----------------------------
        app.post('/coupons', async (req, res) => {
            try {
                const { code, discount, isActive } = req.body;
                if (!code || !discount) {
                    return res.status(400).json({ error: 'Code and discount are required' });
                }
                const cupons = db.collection('cupons');
                const newCoupon = { code, discount, isActive: isActive ?? true };
                const result = await cupons.insertOne(newCoupon);
                res.status(201).json({ message: 'Coupon created', couponId: result.insertedId });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // this is cupon get part--------------------------------------
        app.get('/coupons', async (req, res) => {
            try {
                const cupons = db.collection('cupons');
                const allCoupons = await cupons.find({ isActive: true }).toArray();
                res.json(allCoupons);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });


        // this is court management part--------------------------------------
        app.get('/courts', async (req, res) => {
            try {
                const db = getDB(); // from your db.js
                const courtsCollection = db.collection('court');

                const courts = await courtsCollection.find({}).toArray();
                res.json(courts);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch court data', details: error.message });
            }
        });



        // this is court booking part--------------------------------------

        app.get('/bookings', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');

                // Optional: filter by email if query param is provided
                const userEmail = req.query.email;

                const query = userEmail ? { userEmail } : {};
                const bookings = await bookingsCollection.find(query).toArray();

                res.status(200).json(bookings);
            } catch (error) {
                console.error('Error fetching bookings:', error.message);
                res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
            }
        });

        app.get('/bookings/:email', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');

                const email = req.params.email;

                const userBookings = await bookingsCollection.find({ userEmail: email }).toArray();

                if (userBookings.length === 0) {
                    return res.status(404).json({ message: 'No bookings found for this email' });
                }

                res.status(200).json(userBookings);
            } catch (error) {
                console.error('Error fetching bookings by email:', error.message);
                res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
            }
        });

        app.delete('/bookings/:id', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');
                const bookingId = req.params.id;

                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(bookingId) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Booking not found or already deleted' });
                }

                res.status(200).json({ message: 'Booking deleted successfully' });
            } catch (error) {
                console.error('Error deleting booking:', error.message);
                res.status(500).json({ message: 'Failed to delete booking', error: error.message });
            }
        });





        app.post('/bookings', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');
                const booking = req.body;

                const { userEmail, courtId, slots, date } = booking;

                if (!userEmail || !courtId || !slots || !date) {
                    return res.status(400).json({ message: 'Missing required booking fields.' });
                }

                // Check if any selected slot is already booked
                const conflict = await bookingsCollection.findOne({
                    courtId,
                    date,
                    slots: { $in: slots }
                });

                if (conflict) {
                    return res.status(409).json({ message: 'One or more selected slots are already booked for this court on this date.' });
                }

                // Store booking
                const result = await bookingsCollection.insertOne({
                    ...booking,
                    createdAt: new Date()
                });

                res.status(201).json({ message: 'Booking successful', bookingId: result.insertedId });

            } catch (error) {
                console.error('Booking error:', error.message);
                res.status(500).json({ message: 'Failed to book court', error: error.message });
            }
        });


        // this is user management part--------------------------------------
        app.post('/users', async (req, res) => {
            try {
                const db = getDB();
                const usersCollection = db.collection('users');

                const {
                    name,
                    email,
                    password,
                    role = "user",
                    isMember = false,
                    membershipDate = null,
                    profileImage = "default.jpg"
                } = req.body;

                if (!name || !email || !password) {
                    return res.status(400).json({ message: "Name, email, and password are required." });
                }

                // Optional: check for duplicate user by email
                const existingUser = await usersCollection.findOne({ email });
                if (existingUser) {
                    return res.status(409).json({ message: "User already exists with this email." });
                }

                const user = {
                    name,
                    email,
                    password, // should already be hashed from client
                    role,
                    isMember,
                    membershipDate,
                    profileImage,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await usersCollection.insertOne(user);

                res.status(201).json({
                    message: "User registered successfully",
                    userId: result.insertedId
                });

            } catch (error) {
                console.error("User registration error:", error.message);
                res.status(500).json({ message: "Failed to register user", error: error.message });
            }
        });

        app.get('/users', async (req, res) => {
            try {
                const db = getDB();
                const users = await db.collection('users').find({}).toArray();
                res.status(200).json(users);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch users', error: error.message });
            }
        });


        app.get('/users/:email', async (req, res) => {
            try {
                const db = getDB();
                const email = req.params.email;

                const user = await db.collection('users').findOne({ email });

                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.status(200).json(user);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch user', error: error.message });
            }
        });












        // This is ruunnig port parts
        app.get('/', (req, res) => {
            res.send('🏀 Sports Club Management System API Running');
        });
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('❌ Error starting server:', error.message);
    }
};

startServer();
