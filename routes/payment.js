// 📁 server/routes/payment.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, userEmail, bookingId, description } = req.body;

    // Validate amount
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    // Convert amount to cents safely
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd', // Stripe supports USD
      payment_method_types: ['card'],
      metadata: {
        userEmail,
        bookingId: bookingId || '',
        description: description || ''
      }
    });

    // Here you should also save to your database (like in your first implementation)

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      message: 'Payment failed',
      error: error.message
    });
  }
});

module.exports = router;
