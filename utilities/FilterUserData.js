module.exports = (user) => {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.profile_pic,
        friends: user.friends.map((friend) => ({
            id: friend._id,
            name:friend.name
        })),
    }
}
