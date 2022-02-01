const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // username: {
  //   type: String,
  //   required: true
  // },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    trim: true
  },
  avatar: {
    type: String,
    default: 'https://cdn.onlinewebfonts.com/svg/img_568656.png'
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('user', UserSchema);
