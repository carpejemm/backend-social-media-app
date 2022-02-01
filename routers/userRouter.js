const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

const FilterUserData = require('../utilities/FilterUserData')
const CreateNotification = require('../utilities/CreateNotification');


router.get('/friend-request-sent', 
  auth, 
  async(req, res) => {
    try {
      const friends = await FriendRequest.find({
        $and: [{ isAccepted: false }, { sender: req.userId }],
      }).populate('receiver');
      const friendsData = friends.map((friend) => {
        return {
          id: friend.id,
          user: FilterUserData(friend.receiver),
        }
      });
  
      res.status(200).json({ friends: friendsData });
    } catch (err) {
      console.log(err)
      return res.status(500).json({ error: 'Something went wrong' })
    }
  }
);

router.get(
  '/friend-request-received',
  auth,
  async (req, res) => {
    try {
      const friends = await FriendRequest.find({
        $and: [{ isAccepted: false }, { receiver: req.userId }],
      }).populate('sender', '_id name profile_pic active');
  
      const friendsData = friends.map((friend) => {
        return {
          id: friend.id,
          user: FilterUserData(friend.sender),
        }
      });
  
      res.status(200).json({ friends: friendsData });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Something went wrong'});
    }
  }
);

router.get('/friend-request/:userId/send', 
  auth, 
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      if (req.userId == req.params.userId) {
        return res
          .status(400)
          .json({ error: 'You cannot send friend request to yourself' });
      }
  
      if (user.friends.includes(req.userId)) {
        return res.status(400).json({ error: 'Already Friends' });
      }
  
      const friendRequest = await FriendRequest.findOne({
        sender: req.userId,
        receiver: req.params.userId,
      })
  
      if (friendRequest) {
        return res.status(400).json({ error: 'Friend Request already sent' });
      }
  
      const newFriendRequest = new FriendRequest({
        sender: req.userId,
        receiver: req.params.userId,
      });
  
      const save = await newFriendRequest.save();
  
      const friend = await FriendRequest.findById(save.id).populate('receiver');
  
      const chunkData = {
        id: friend.id,
        user: FilterUserData(friend.receiver),
      }
  
      res
        .status(200)
        .json({ message: 'Friend Request Sended', friend: chunkData });
  
      const sender = await FriendRequest.findById(save.id).populate('sender');
      let notification = await CreateNotification({
        user: req.params.userId,
        body: `${sender.sender.name} has send you friend request`,
      });
      const senderData = {
        id: sender.id,
        user: FilterUserData(sender.sender),
      }
  
      if (user.socketId) {
        req.io
          .to(user.socketId)
          .emit('friend-request-status', { sender: senderData })
        req.io.to(user.socketId).emit('Notification', { data: notification })
      };
    } catch (err) {
      console.log(err)
      return res.status(500).json({error:"Something went wrong"})
    }
  }
);

router.get(
  '/friend-request/:requestId/accept',
  auth,
  async (req, res) => {
    try {
      const friendsRequest = await FriendRequest.findById(req.params.requestId);
      if (!friendsRequest) {
        return res
          .status(404)
          .json({ error: 'Request already accepted or not sended yet' });
      }
  
      const sender = await User.findById(friendsRequest.sender)
      if (sender.friends.includes(friendsRequest.receiver)) {
        return res.status(400).json({ error: 'already in your friend lists' });
      }
      sender.friends.push(req.userId);
      await sender.save();
  
      const currentUser = await User.findById(req.userId)
      if (currentUser.friends.includes(friendsRequest.sender)) {
        return res.status(400).json({ error: 'already  friend ' });
      }
      currentUser.friends.push(friendsRequest.sender);
      await currentUser.save();
  
      const chunkData = FilterUserData(sender);
  
      await FriendRequest.deleteOne({ _id: req.params.requestId });
      res
        .status(200)
        .json({ message: 'Friend Request Accepted', user: chunkData });
  
      let notification = await CreateNotification({
        user: sender.id,
        body: `${currentUser.name} has accepted your friend request`,
      });
      if (sender.socketId) {
        let currentUserData = FilterUserData(currentUser)
        req.io.to(sender.socketId).emit('friend-request-accept-status', {
          user: currentUserData,
          request_id: req.params.requestId,
        })
        req.io.to(sender.socketId).emit('Notification', { data: notification });
      }
    } catch (err) {
      console.log(err)
      return res.status(500).json({error:"Something went wrong"})
    }
  }
);

router.get(
  '/friend-request/:requestId/cancel',
  auth,
  async (req, res) => {
    try {
      const friendsRequest = await FriendRequest.findById(
        req.params.requestId,
      ).populate('receiver');
      if (!friendsRequest) {
        return res
          .status(404)
          .json({ error: 'Request already canceled or not sent' });
      }
      await FriendRequest.deleteOne({ _id: req.params.requestId });
  
      res.status(200).json({ message: 'Friend Request Canceled' });
      if (friendsRequest.receiver.socketId) {
        req.io
          .to(friendsRequest.receiver.socketId)
          .emit('sended-friend-request-cancel', {
            requestId: req.params.requestId,
          })
      }
    } catch (err) {
      console.log(err)
      return res.status(500).json({error:"Something went wrong"})
    }
  }
)

router.get(
  '/friend-request/:requestId/decline',
  auth,
  async (req, res) => {
    try {
      const friendsRequest = await FriendRequest.findById(
        req.params.requestId,
      ).populate('sender');
      if (!friendsRequest) {
        return res
          .status(404)
          .json({ error: 'Request already declined or not sended yet' })
      }
      await FriendRequest.deleteOne({ _id: req.params.requestId })
  
      res.status(200).json({ message: 'Friend Request Declined' })
      if (friendsRequest.sender.socketId) {
        req.io
          .to(friendsRequest.sender.socketId)
          .emit('received-friend-request-decline', {
            requestId: req.params.requestId,
          })
      }
    } catch (err) {
      console.log(err)
      return res.status(500).json({error:"Something went wrong"})
    }
  }
);


router.post(
  '/register',
  [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body(
      'password',
      'Please enter a password with 8 or more characters'
    ).isLength({ min: 8 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, avatar, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }

      user = new User({
        name,
        email,
        avatar,
        password
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        config.get('jwtSecret'),
        { expiresIn: 360000 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
