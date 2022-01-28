const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.send('This is the profile route');
});


module.exports = router;