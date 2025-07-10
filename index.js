const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, getDB } = require('./config/db');
const { ObjectId } = require('mongodb'); // Make sure to import this
const paymentRoutes = require('./routes/payment');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Initialize Stripe with your secret key


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', paymentRoutes);

// Start Server
const startServer = async () => {
    try {
        await connectDB();
        const db = getDB();

        // ============== STRIPE PAYMENT INTENT ENDPOINT ==============




        // This is cupone management part----------------------------
        app.post('/coupons', async (req, res) => {
            try {
                console.log('Received coupon data:', req.body); // Debug log

                const { code, value, description, expiry, isActive } = req.body;

                // More detailed validation
                if (!code || code.trim() === '') {
                    return res.status(400).json({ error: 'Coupon code is required and cannot be empty' });
                }

                if (value === undefined || value === null || value === '') {
                    return res.status(400).json({ error: 'Coupon value is required' });
                }

                // Convert value to number if it's a string
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;

                if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
                    return res.status(400).json({ error: 'Value must be a valid number between 0 and 100' });
                }

                // Validate expiry date if provided
                let expiryDate = null;
                if (expiry) {
                    expiryDate = new Date(expiry);
                    if (isNaN(expiryDate.getTime())) {
                        return res.status(400).json({ error: 'Invalid expiry date format' });
                    }
                    if (expiryDate < new Date()) {
                        return res.status(400).json({ error: 'Expiry date cannot be in the past' });
                    }
                }

                const cupons = db.collection('cupons');

                // Check if coupon code already exists
                const existingCoupon = await cupons.findOne({ code: code.trim().toUpperCase() });
                if (existingCoupon) {
                    return res.status(409).json({ error: 'Coupon code already exists' });
                }

                const newCoupon = {
                    code: code.trim().toUpperCase(),
                    value: numericValue,
                    description: description ? description.trim() : '',
                    expiry: expiryDate,
                    isActive: isActive ?? true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await cupons.insertOne(newCoupon);

                res.status(201).json({
                    message: 'Coupon created successfully',
                    couponId: result.insertedId,
                    coupon: newCoupon
                });
            } catch (error) {
                console.error('Error creating coupon:', error.message);
                res.status(500).json({ error: 'Failed to create coupon', details: error.message });
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

        // Update existing coupon
        app.put('/coupons/:id', async (req, res) => {
            try {
                const cupons = db.collection('cupons');
                const couponId = req.params.id;
                const { code, value, description, expiry, isActive } = req.body;

                // Check if coupon exists
                const existingCoupon = await cupons.findOne({ _id: new ObjectId(couponId) });
                if (!existingCoupon) {
                    return res.status(404).json({ error: 'Coupon not found' });
                }

                const updateData = {
                    updatedAt: new Date()
                };

                // Only update fields that are provided
                if (code !== undefined) {
                    // Check if new code already exists (if different from current)
                    if (code.trim().toUpperCase() !== existingCoupon.code) {
                        const codeExists = await cupons.findOne({ code: code.trim().toUpperCase() });
                        if (codeExists) {
                            return res.status(409).json({ error: 'Coupon code already exists' });
                        }
                    }
                    updateData.code = code.trim().toUpperCase();
                }

                if (value !== undefined) {
                    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                    if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
                        return res.status(400).json({ error: 'Value must be a valid number between 0 and 100' });
                    }
                    updateData.value = numericValue;
                }

                if (description !== undefined) {
                    updateData.description = description ? description.trim() : '';
                }

                if (expiry !== undefined) {
                    if (expiry) {
                        const expiryDate = new Date(expiry);
                        if (isNaN(expiryDate.getTime())) {
                            return res.status(400).json({ error: 'Invalid expiry date format' });
                        }
                        updateData.expiry = expiryDate;
                    } else {
                        updateData.expiry = null;
                    }
                }

                if (isActive !== undefined) updateData.isActive = isActive;

                const result = await cupons.updateOne(
                    { _id: new ObjectId(couponId) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ error: 'No changes made to the coupon' });
                }

                // Get the updated coupon
                const updatedCoupon = await cupons.findOne({ _id: new ObjectId(couponId) });

                res.status(200).json({
                    message: 'Coupon updated successfully',
                    coupon: updatedCoupon
                });

            } catch (error) {
                console.error('Error updating coupon:', error.message);
                res.status(500).json({ error: 'Failed to update coupon', details: error.message });
            }
        });

        // Delete coupon
        app.delete('/coupons/:id', async (req, res) => {
            try {
                const cupons = db.collection('cupons');
                const couponId = req.params.id;

                // Check if coupon exists
                const existingCoupon = await cupons.findOne({ _id: new ObjectId(couponId) });
                if (!existingCoupon) {
                    return res.status(404).json({ error: 'Coupon not found' });
                }

                // Option 1: Soft delete (set isActive to false)
                // Uncomment this if you want to keep coupon history
                /*
                const result = await cupons.updateOne(
                    { _id: new ObjectId(couponId) },
                    {
                        $set: {
                            isActive: false,
                            deletedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                res.status(200).json({
                    message: 'Coupon deactivated successfully',
                    couponId: couponId,
                    action: 'deactivated'
                });
                */

                // Option 2: Hard delete (completely remove from database)
                const result = await cupons.deleteOne({ _id: new ObjectId(couponId) });

                res.status(200).json({
                    message: 'Coupon deleted successfully',
                    deletedCoupon: {
                        id: couponId,
                        code: existingCoupon.code
                    },
                    action: 'deleted'
                });

            } catch (error) {
                console.error('Error deleting coupon:', error.message);
                res.status(500).json({ error: 'Failed to delete coupon', details: error.message });
            }
        });

        // Get all coupons (including inactive ones) - for admin purposes
        app.get('/coupons/all', async (req, res) => {
            try {
                const cupons = db.collection('cupons');
                const allCoupons = await cupons.find({}).sort({ createdAt: -1 }).toArray();
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

                // Sort by createdAt in descending order (newest first)
                const courts = await courtsCollection.find({}).sort({ createdAt: -1 }).toArray();
                res.json(courts);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch court data', details: error.message });
            }
        });

        // Add new court
        app.post('/courts', async (req, res) => {
            try {
                const db = getDB();
                const courtsCollection = db.collection('court');

                console.log('Received court data:', req.body); // Debug log

                const { name, type, description, price, capacity, amenities, isActive = true, image, slots } = req.body;

                // More flexible validation with better error messages
                if (!name || name.trim() === '') {
                    return res.status(400).json({ message: 'Court name is required and cannot be empty' });
                }

                if (!type || type.trim() === '') {
                    return res.status(400).json({ message: 'Court type is required and cannot be empty' });
                }

                if (price === undefined || price === null || price === '') {
                    return res.status(400).json({ message: 'Court price is required' });
                }

                // Convert price to number if it's a string
                const numericPrice = typeof price === 'string' ? parseFloat(price) : price;

                if (isNaN(numericPrice) || numericPrice < 0) {
                    return res.status(400).json({ message: 'Price must be a valid positive number' });
                }

                // Process slots - handle both string and array formats
                let processedSlots = [];
                if (slots) {
                    if (typeof slots === 'string') {
                        processedSlots = slots.split(",").map((slot) => slot.trim()).filter(slot => slot);
                    } else if (Array.isArray(slots)) {
                        processedSlots = slots.filter(slot => slot && slot.trim()).map(slot => slot.trim());
                    }
                }

                const newCourt = {
                    name: name.trim(),
                    type: type.trim(),
                    description: description ? description.trim() : '',
                    price: numericPrice,
                    capacity: capacity ? parseInt(capacity) : 10,
                    amenities: Array.isArray(amenities) ? amenities : [],
                    slots: processedSlots,
                    image: image || '',
                    isActive,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await courtsCollection.insertOne(newCourt);

                res.status(201).json({
                    message: 'Court created successfully',
                    courtId: result.insertedId,
                    court: newCourt
                });

            } catch (error) {
                console.error('Error creating court:', error.message);
                res.status(500).json({ message: 'Failed to create court', error: error.message });
            }
        });

        // Update existing court
        app.put('/courts/:id', async (req, res) => {
            try {
                const db = getDB();
                const courtsCollection = db.collection('court');
                const courtId = req.params.id;

                const { name, type, description, price, capacity, amenities, isActive } = req.body;

                // Check if court exists
                const existingCourt = await courtsCollection.findOne({ _id: new ObjectId(courtId) });
                if (!existingCourt) {
                    return res.status(404).json({ message: 'Court not found' });
                }

                const updateData = {
                    updatedAt: new Date()
                };

                // Only update fields that are provided
                if (name !== undefined) updateData.name = name;
                if (type !== undefined) updateData.type = type;
                if (description !== undefined) updateData.description = description;
                if (price !== undefined) updateData.price = price;
                if (capacity !== undefined) updateData.capacity = capacity;
                if (amenities !== undefined) updateData.amenities = amenities;
                if (isActive !== undefined) updateData.isActive = isActive;

                const result = await courtsCollection.updateOne(
                    { _id: new ObjectId(courtId) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ message: 'No changes made to the court' });
                }

                // Get the updated court
                const updatedCourt = await courtsCollection.findOne({ _id: new ObjectId(courtId) });

                res.status(200).json({
                    message: 'Court updated successfully',
                    court: updatedCourt
                });

            } catch (error) {
                console.error('Error updating court:', error.message);
                res.status(500).json({ message: 'Failed to update court', error: error.message });
            }
        });

        // Delete court
        app.delete('/courts/:id', async (req, res) => {
            try {
                const db = getDB();
                const courtsCollection = db.collection('court');
                const bookingsCollection = db.collection('bookings');
                const courtId = req.params.id;

                // Check if court exists
                const existingCourt = await courtsCollection.findOne({ _id: new ObjectId(courtId) });
                if (!existingCourt) {
                    return res.status(404).json({ message: 'Court not found' });
                }

                // Check if there are any bookings for this court
                const existingBookings = await bookingsCollection.find({ courtId }).toArray();

                if (existingBookings.length > 0) {
                    // Instead of hard delete, you might want to set isActive to false
                    const result = await courtsCollection.updateOne(
                        { _id: new ObjectId(courtId) },
                        {
                            $set: {
                                isActive: false,
                                deletedAt: new Date(),
                                updatedAt: new Date()
                            }
                        }
                    );

                    return res.status(200).json({
                        message: 'Court deactivated successfully (has existing bookings)',
                        courtId: courtId,
                        affectedBookings: existingBookings.length,
                        action: 'deactivated'
                    });
                } else {
                    // No bookings, safe to delete
                    const result = await courtsCollection.deleteOne({ _id: new ObjectId(courtId) });

                    res.status(200).json({
                        message: 'Court deleted successfully',
                        deletedCourt: {
                            id: courtId,
                            name: existingCourt.name
                        },
                        action: 'deleted'
                    });
                }

            } catch (error) {
                console.error('Error deleting court:', error.message);
                res.status(500).json({ message: 'Failed to delete court', error: error.message });
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


        // Delete a specific pending booking by ID
        app.delete('/bookings/pending/email/:id', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');
                const bookingId = req.params.id;

                // Validate ObjectId format
                if (!ObjectId.isValid(bookingId)) {
                    return res.status(400).json({ message: 'Invalid booking ID format' });
                }

                // Check if booking exists and is pending
                const existingBooking = await bookingsCollection.findOne({
                    _id: new ObjectId(bookingId),
                    status: "pending"
                });

                if (!existingBooking) {
                    return res.status(404).json({ message: 'Pending booking not found' });
                }

                // Delete the pending booking
                const result = await bookingsCollection.deleteOne({
                    _id: new ObjectId(bookingId),
                    status: "pending"
                });

                if (result.deletedCount === 0) {
                    return res.status(400).json({ message: 'Failed to delete pending booking' });
                }

                res.status(200).json({
                    message: 'Pending booking deleted successfully',
                    deletedBooking: {
                        id: bookingId,
                        userEmail: existingBooking.userEmail,
                        courtId: existingBooking.courtId,
                        date: existingBooking.date,
                        slots: existingBooking.slots
                    }
                });

            } catch (error) {
                console.error('Error deleting pending booking:', error.message);
                res.status(500).json({ message: 'Failed to delete pending booking', error: error.message });
            }
        });

        // Get approved bookings for a specific user email
        app.get('/bookings/approved/:email', async (req, res) => {
            try {
                const db = getDB();
                const bookingsCollection = db.collection('bookings');
                const email = req.params.email;

                const approvedBookings = await bookingsCollection
                    .find({
                        status: "approved",
                        userEmail: email
                    })
                    .sort({ createdAt: -1 }) // Show newest first
                    .toArray();

                if (approvedBookings.length === 0) {
                    return res.status(200).json([]);
                }

                // Format the response to show approved booking details
                const formattedBookings = approvedBookings.map(booking => ({
                    _id: booking._id,
                    userEmail: booking.userEmail,
                    courtId: booking.courtId,
                    courtName: booking.courtType || 'N/A',
                    date: booking.date,
                    slots: booking.slots,
                    status: booking.status,
                    price: booking.price || 0,
                    approvedAt: booking.updatedAt,
                    createdAt: booking.createdAt
                }));

                res.status(200).json(formattedBookings);
            } catch (error) {
                console.error("Error fetching approved bookings for specific email:", error.message);
                res.status(500).json({ message: "Failed to fetch approved bookings for this user", error: error.message });
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

        // Get all users with "member" role
        app.get('/users/role/members', async (req, res) => {
            try {
                const db = getDB();
                const usersCollection = db.collection('users');

                // Find all users with role "member"
                const members = await usersCollection.find({ role: "member" }).toArray();

                if (members.length === 0) {
                    return res.status(404).json({ message: 'No members found' });
                }

                // Return only the members array directly
                res.status(200).json(members);

            } catch (error) {
                console.error('Error fetching members:', error.message);
                res.status(500).json({ message: 'Failed to fetch members', error: error.message });
            }
        });



        // Revoke member status - change member back to user
        app.delete('/users/member/:email', async (req, res) => {
            try {
                const db = getDB();
                const usersCollection = db.collection('users');
                const bookingsCollection = db.collection('bookings');
                const email = req.params.email;

                // First, check if the user exists and is a member
                const user = await usersCollection.findOne({ email, role: "member" });
                if (!user) {
                    return res.status(404).json({ message: 'Member not found' });
                }

                // Delete all bookings associated with this member
                const bookingDeleteResult = await bookingsCollection.deleteMany({ userEmail: email });

                // Change user role from "member" back to "user" instead of deleting
                const userUpdateResult = await usersCollection.updateOne(
                    { email, role: "member" },
                    {
                        $set: {
                            role: "user",
                            isMember: false,
                            membershipDate: null,
                            updatedAt: new Date()
                        }
                    }
                );

                if (userUpdateResult.modifiedCount === 0) {
                    return res.status(400).json({ message: 'Failed to revoke member status' });
                }

                res.status(200).json({
                    message: 'Member status revoked successfully - user changed back to regular user',
                    updatedUser: {
                        email: email,
                        name: user.name,
                        newRole: "user"
                    },
                    deletedBookings: bookingDeleteResult.deletedCount
                });

            } catch (error) {
                console.error('Error revoking member status:', error.message);
                res.status(500).json({ message: 'Failed to revoke member status', error: error.message });
            }
        });



        // ============== ANNOUNCEMENT MANAGEMENT ==============

        // Create new announcement
        app.post('/announcements', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { title, message, author = 'Admin', date, priority, isActive } = req.body;

                // Debug logging for announcement creation
                console.log('📢 Creating announcement:', { title, message, author, date, priority, isActive });

                // Validation
                if (!title || !message) {
                    return res.status(400).json({
                        message: 'Title and message are required',
                        received: { title, message }
                    });
                }

                if (title.length < 3 || title.length > 200) {
                    return res.status(400).json({ message: 'Title must be between 3 and 200 characters' });
                }

                if (message.length < 5 || message.length > 1000) {
                    return res.status(400).json({ message: 'Message must be between 5 and 1000 characters' });
                }

                const announcement = {
                    title: title.trim(),
                    message: message.trim(),
                    author: author.trim(),
                    date: date ? new Date(date) : new Date(),
                    priority: priority || 'normal', // normal, high, urgent
                    isActive: isActive !== undefined ? isActive : true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await announcementsCollection.insertOne(announcement);

                // Return the created announcement with the ID
                const createdAnnouncement = {
                    _id: result.insertedId,
                    ...announcement
                };

                res.status(201).json({
                    message: 'Announcement created successfully',
                    announcement: createdAnnouncement
                });
            } catch (error) {
                console.error('Error creating announcement:', error.message);
                res.status(500).json({ message: 'Failed to create announcement', error: error.message });
            }
        });

        // Get all announcements (sorted by date descending)
        app.get('/announcements', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { isActive, priority } = req.query;
                let filter = {};

                // Filter by active status if specified
                if (isActive !== undefined) {
                    filter.isActive = isActive === 'true';
                }

                // Filter by priority if specified
                if (priority) {
                    filter.priority = priority;
                }

                const announcements = await announcementsCollection
                    .find(filter)
                    .sort({ date: -1, createdAt: -1 })
                    .toArray();

                // Return announcements array directly
                res.status(200).json(announcements);
            } catch (error) {
                console.error('Error fetching announcements:', error.message);
                res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
            }
        });

        // Get single announcement by ID
        app.get('/announcements/:id', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { id } = req.params;

                // Validate ObjectId format
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid announcement ID format' });
                }

                const announcement = await announcementsCollection.findOne({ _id: new ObjectId(id) });

                if (!announcement) {
                    return res.status(404).json({ message: 'Announcement not found' });
                }

                res.status(200).json({
                    message: 'Announcement fetched successfully',
                    announcement
                });
            } catch (error) {
                console.error('Error fetching announcement:', error.message);
                res.status(500).json({ message: 'Failed to fetch announcement', error: error.message });
            }
        });

        // Update announcement
        app.put('/announcements/:id', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { id } = req.params;
                const { title, message, author, date, priority, isActive } = req.body;

                // Validate ObjectId format
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid announcement ID format' });
                }

                // Check if announcement exists
                const existingAnnouncement = await announcementsCollection.findOne({ _id: new ObjectId(id) });
                if (!existingAnnouncement) {
                    return res.status(404).json({ message: 'Announcement not found' });
                }

                // Validation
                if (title && (title.length < 3 || title.length > 200)) {
                    return res.status(400).json({ message: 'Title must be between 3 and 200 characters' });
                }

                if (message && (message.length < 5 || message.length > 1000)) {
                    return res.status(400).json({ message: 'Message must be between 5 and 1000 characters' });
                }

                // Build update object
                const updateData = {
                    updatedAt: new Date()
                };

                if (title !== undefined) updateData.title = title.trim();
                if (message !== undefined) updateData.message = message.trim();
                if (author !== undefined) updateData.author = author.trim();
                if (date !== undefined) updateData.date = new Date(date);
                if (priority !== undefined) updateData.priority = priority;
                if (isActive !== undefined) updateData.isActive = isActive;

                const result = await announcementsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ message: 'No changes made to announcement' });
                }

                // Fetch and return updated announcement
                const updatedAnnouncement = await announcementsCollection.findOne({ _id: new ObjectId(id) });

                res.status(200).json({
                    message: 'Announcement updated successfully',
                    announcement: updatedAnnouncement
                });
            } catch (error) {
                console.error('Error updating announcement:', error.message);
                res.status(500).json({ message: 'Failed to update announcement', error: error.message });
            }
        });

        // Delete announcement
        app.delete('/announcements/:id', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { id } = req.params;

                // Validate ObjectId format
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid announcement ID format' });
                }

                // Check if announcement exists before deleting
                const existingAnnouncement = await announcementsCollection.findOne({ _id: new ObjectId(id) });
                if (!existingAnnouncement) {
                    return res.status(404).json({ message: 'Announcement not found' });
                }

                const result = await announcementsCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(400).json({ message: 'Failed to delete announcement' });
                }

                res.status(200).json({
                    message: 'Announcement deleted successfully',
                    deletedAnnouncement: {
                        id: id,
                        title: existingAnnouncement.title
                    }
                });
            } catch (error) {
                console.error('Error deleting announcement:', error.message);
                res.status(500).json({ message: 'Failed to delete announcement', error: error.message });
            }
        });

        // Toggle announcement active status
        app.patch('/announcements/:id/toggle', async (req, res) => {
            try {
                const db = getDB();
                const announcementsCollection = db.collection('announcements');

                const { id } = req.params;

                // Validate ObjectId format
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid announcement ID format' });
                }

                // Check if announcement exists
                const existingAnnouncement = await announcementsCollection.findOne({ _id: new ObjectId(id) });
                if (!existingAnnouncement) {
                    return res.status(404).json({ message: 'Announcement not found' });
                }

                const newStatus = !existingAnnouncement.isActive;

                const result = await announcementsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            isActive: newStatus,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ message: 'Failed to toggle announcement status' });
                }

                res.status(200).json({
                    message: `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully`,
                    announcement: {
                        id: id,
                        title: existingAnnouncement.title,
                        isActive: newStatus
                    }
                });
            } catch (error) {
                console.error('Error toggling announcement status:', error.message);
                res.status(500).json({ message: 'Failed to toggle announcement status', error: error.message });
            }
        });











        // ============== PAYMENTS MANAGEMENT ==============
 app.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency, paymentMethodId, bookingId } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency || 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {  // Move these to metadata
                paymentMethodId: paymentMethodId,
                bookingId: bookingId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
