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

        // Move this route BEFORE the :email route to avoid conflicts
        app.get('/bookings/status', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');

                const pendingBookings = await bookingsCollection
                    .find({ status: "pending" })
                    .toArray();

                res.status(200).json(pendingBookings);
            } catch (error) {
                console.error("Error fetching pending bookings:", error.message);
                res.status(500).json({ message: "Failed to fetch pending bookings", error: error.message });
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


        // Update booking status to approved
        app.patch('/bookings/:id/status', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');
                const usersCollection = db.collection('users');
                const bookingId = req.params.id;
                const { status } = req.body;

                // Validate status
                const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
                if (!status || !validStatuses.includes(status)) {
                    return res.status(400).json({
                        message: 'Invalid status. Valid statuses are: pending, approved, rejected, cancelled'
                    });
                }

                // Check if booking exists
                const existingBooking = await bookingsCollection.findOne({ _id: new ObjectId(bookingId) });
                if (!existingBooking) {
                    return res.status(404).json({ message: 'Booking not found' });
                }

                // Update booking status
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(bookingId) },
                    {
                        $set: {
                            status: status,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ message: 'Failed to update booking status' });
                }

                // If booking is approved, update user role to "member" and set membership details
                if (status === 'approved') {
                    const userEmail = existingBooking.userEmail;

                    if (userEmail) {
                        await usersCollection.updateOne(
                            { email: userEmail },
                            {
                                $set: {
                                    role: "member",
                                    isMember: true,
                                    membershipDate: new Date(),
                                    updatedAt: new Date()
                                }
                            }
                        );
                    }
                }

                res.status(200).json({
                    message: status === 'approved'
                        ? `Booking approved successfully and user upgraded to member`
                        : `Booking status updated to ${status} successfully`,
                    bookingId: bookingId,
                    status: status,
                    userUpgraded: status === 'approved'
                });

            } catch (error) {
                console.error('Error updating booking status:', error.message);
                res.status(500).json({ message: 'Failed to update booking status', error: error.message });
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
                const usersCollection = db.collection('users');

                // Check if email query parameter is provided
                const email = req.query.email;

                if (email) {
                    // If email is provided, find specific user
                    const user = await usersCollection.findOne({ email });
                    if (!user) {
                        return res.status(404).json({ message: 'User not found' });
                    }
                    res.status(200).json(user);
                } else {
                    // If no email provided, return all users
                    const users = await usersCollection.find({}).toArray();
                    res.status(200).json(users);
                }
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




        // this is announcement part--------------------------------------
        app.post('/api/announcements', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { title, content, author, date } = req.body;

                if (!title || !content || !author) {
                    return res.status(400).json({ message: 'Title, content, and author are required' });
                }

                const announcement = {
                    title,
                    content,
                    author,
                    date: date ? new Date(date) : new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await announcementsCollection.insertOne(announcement);

                res.status(201).json({
                    message: 'Announcement posted successfully',
                    announcementId: result.insertedId,
                });
            } catch (error) {
                console.error('Error posting announcement:', error.message);
                res.status(500).json({ message: 'Failed to post announcement', error: error.message });
            }
        });

        app.get('/announcements', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                // Optionally sort by date descending
                const announcements = await announcementsCollection
                    .find({})
                    .sort({ date: -1 })
                    .toArray();

                res.status(200).json(announcements);
            } catch (error) {
                console.error('Error fetching announcements:', error.message);
                res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
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
