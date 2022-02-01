const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const connectDB = require('./config/db');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);
const authRouter = require('./routers/authRouter');
const userRouter = require('./routers/userRouter');
const profileRouter = require('./routers/profileRouter');
const postRouter = require('./routers/postRouter');

connectDB();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use((req, res, next) => {
    io.req = req
    req.io = io
    next()
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/profile', profileRouter);
app.use('/api/posts', postRouter);

require('./socket')(io);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));