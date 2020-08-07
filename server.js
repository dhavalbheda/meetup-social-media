const express = require('express')
const app = express()

const formidable = require('express-formidable')
app.use(formidable())

const mongodb = require('mongodb')
const mongoClient = mongodb.MongoClient
const ObjectId = mongodb.ObjectID;

const http = require('http').createServer(app)
const bcrypt = require('bcrypt')
const fileSystem = require('fs')
const moveFile = require('mv')

const jwt = require('jsonwebtoken')
const { connect } = require('http2')
const { measureMemory } = require('vm')
const tokenSecret = 'UsetTokenSecret'

app.use("/public", express.static(__dirname + "/public"))
app.set('view engine', 'ejs')


const socketIO= require('socket.io')(http)
var socketId = ''
var users = []
const mainURL = process.env.MAIN_URL
const DBURL = process.env.DBURL
const port = process.env.PORT

socketIO.on('connection', (socket) => {
    console.log('User Connected', socket.id)
    socketId = socket.id
})

http.listen(port, () => {
    console.log('Server Started')
    let db = null 

    mongoClient.connect(DBURL, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }, (error, client) => {
               db = client.db('social_media')
            })
    

    app.get('/signup', (req, res) => {
        res.render('signup')
    })
    app.post('/signup', (req, res) => {
        var name= req.fields.name
        var username = req.fields.username
        var email = req.fields.email
        var password = req.fields.password
        var gender = req.fields.gender

        db.collection('users').findOne({
            $or: [{
                'email': email
            },{
                'username':username
            }]
        }, (error, user) => {
            if(user == null) {
                bcrypt.hash(password, 10, (error, hash) => {
                    db.collection('users').insertOne({
                        "name":name,
                        "username":username,
                        "email": email,
                        "password": hash,
                        "gender": gender,
                        "profileImage": '',
                        "coverPhoto": '',
                        "dob": '',
                        "city":'',
                        "country":'',
                        "aboutMe": '',
                        "friends": [],
                        "pages": [],
                        "notifications":[],
                        "groups": [],
                        "post":[]
                    }, (error, data) => {
                        res.json({
                            "status":"success",
                            "message": "signed Up Successfully"
                        })
                    })                    
                })
            } else {
                res.json({
                    "status": "error",
                    "message": "Email Or Username Already Exist"
                })
            }
        })
    })
    app.get('/login', (req, res) => {
        res.render('login')
    })
    app.post('/login', (req, res) => {
        var email = req.fields.email
        var password = req.fields.password
        db.collection('users').findOne({
            'email':email
        }, (error, user) => {

            if(user == null) {
                res.json({
                    "status":"error",
                    "message":"Email Does Not Exits"
                })   
            } else {
                bcrypt.compare(password, user.password, (error, isVerify) => {
                    if(isVerify) {
                        var accessToken = jwt.sign({email}, tokenSecret)
                        db.collection('users').findOneAndUpdate({email},{$set : {accessToken}}, (error, result) => {
                           res.json({
                               status: "success",
                               message: "login Successfully",
                               accessToken,
                               profileImage: user.profileImage
                           }) 
                        })                        
                    } else {
                        res.json({
                            status: "error",
                            message: "Password Incorrect.."
                        })
                    }
                })
            }
        })
    })
    app.get('/updateprofile', (req, res) => {
        res.render('updateprofile')
    })
    app.post('/getUser', (req, res) => {
        var accessToken = req.fields.accessToken
        db.collection('users').findOne({accessToken}, (error, user) => {
            if(user == null) {
                res.json({
                    "status":"error",
                    "message":"User Has Been Logged Out .. "
                })   
            } else { 
                res.json({
                    status: "success",
                    message: "Record Has Been Fetched",
                    data: user
                })
            }
        })
    })
    app.get('/logout', (req, res) => {
        res.redirect('/login')
    })
    app.get("/user/:username", (req, res) => {
        db.collection("users").findOne({
            "_id": ObjectId(req.params.username)
        }, (error, user) => {
            if (user == null) {
                res.send({
                    "status": "error",
                    "message": "User does not exists"
                });
            } else {
                res.render("userProfile", {user,mainURL});
            }
        });
    });
    app.post('/uploadCoverPhoto', (req, res) => {
        var accessToken = req.fields.accessToken
        var coverPhoto = ""
        db.collection('users').findOne({accessToken}, (error, user) => {
            if(user == null) {
                res.json({
                    "status":"error",
                    "message":"User Has Been Logged Out .. "
                })   
            } else {
                if (req.files.coverPhoto.size > 0 && req.files.coverPhoto.type.includes("image")) {
                    if(user.coverPhoto != "") {
                        fileSystem.unlink(user.coverPhoto, (error) => {
                            //
                        })
                    }
                    coverPhoto = "public/images/" + new Date().getTime() + "-" + req.files.coverPhoto.name;
						moveFile(req.files.coverPhoto.path, coverPhoto, function (error) {
							 console.log("eror",error)
                        });
                    db.collection("users").updateOne({accessToken}, {$set: {coverPhoto}}, (error, result) => {
                       
                        res.json({status:"status",
                                message:"Cover Image Has Been Updated",
                                data:"/"+coverPhoto
                                })
                    })
                } else {
                    res.json({
                        "status": "error",
                        "message": "Please Select Valid Image."
                        })
                }
            }
        })
    })
    app.post('/uploadProfileImage',(req, res) => {
        var accessToken = req.fields.accessToken;
        var profileImage = ""
        
        db.collection('users').findOne({accessToken},(error,user) => {
            if(user == null) {
                res.json({
                    "status":"error",
                    "message":"User Has Been Logged Out .. "
                })   
            } else {
                if(req.files.profileImage.size > 0 && req.files.profileImage.type.includes('image')) {
                    if(user.profileImage != "") {
                        fileSystem.unlink(user.profileImage, error => false)
                    }
                
                    profileImage = "public/images/" + new Date().getTime() + "-" + req.files.profileImage.name;
                    moveFile(req.files.profileImage.path, profileImage, error => false);
                    
                    db.collection("users").updateOne({accessToken}, {$set: {profileImage}}, (error, result) => {
                            
                        res.json({status:"status",
                                message:"Profile Image Has Been Updated",
                                data:"/"+profileImage
                                })
                    })
                } else {
                    res.json({
                        "status": "error",
                        "message": "Please Select Valid Image."
                        })
                }
            }
        })
    })
    app.post('/updateProfile', (req, res) => {
        var accessToken = req.fields.accessToken;
        var name = req.fields.name;
        var dob = req.fields.dob;
        var city = req.fields.city;
        var country = req.fields.country;
        var aboutMe = req.fields.aboutMe;

        db.collection("users").findOne({accessToken}, (error,user) => {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                db.collection('users').updateOne({accessToken},{
                    $set: {
                        name,
                        dob,
                        city,
                        country,
                        aboutMe
                    }
                }, (error, data) => {
                    res.json({
                        "status":"status",
                        "message":"Profile Has Benn Updated..."
                    })
                })
            }
        })
    })
    app.get('/', (req, res) => {
        res.render('index')
    })
    app.post("/addPost", (req, res) => {
        var accessToken = req.fields.accessToken;
        var caption = req.fields.caption;
        var image = "";
        var video = "";
        var type = req.fields.type;
        var createdAt = new Date().getTime();
        var _id = req.fields._id;

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                if(req.files.image) 
                {
                    if (req.files.image && req.files.image.size > 0 && req.files.image.type.includes("image")) {
                        image = "public/images/" + new Date().getTime() + "-" + req.files.image.name;
                        moveFile(req.files.image.path, image,(error) => error?console.log(error):'');
                    } 
                }
                if(req.files.video) {
                    if (req.files.video.size > 0 && req.files.video.type.includes("video")) {
                        video = "public/videos/" + new Date().getTime() + "-" + req.files.video.name;
                        moveFile(req.files.video.path, video,(error) => error?console.log(error):'');
                    }
                }
                if(type == 'page_post') {
                    db.collection('pages').findOne({'_id':ObjectId(_id)}, (error, page) => {
                        if(page == null) {
                            res.json({
                                status:'error',
                                message: 'Page Does Not Exist. '
                            })
                            return;
                        } else {
                            if(page.user._id.toString() != user._id.toString()) {
                                res.json({
                                    status: 'error',
                                    message: 'Sorry, You Do Not Own This Page '
                                })
                                return
                            }
                            db.collection('posts').insertOne({
                                caption,
                                image,
                                video,
                                type,
                                createdAt,
                                likers: [],
                                comments: [],
                                shares:[],
                                user: {
                                    _id: page._id,
                                    name:page.name,
                                    profileImage: page.coverPhoto
                                }
                            }, (error, data) => {
                                res.json({
                                    status: 'success',
                                    message: 'Post Has Been Uploaded'
                                })
                                
                            })
                        }
                    })
                } else if(type == 'group_post') {
                    db.collection('groups').findOne({'_id':ObjectId(_id)}, (error, group) => {
                        if(group == null) {
                            res.json({
                                status:'error',
                                message: 'Page Does Not Exist. '
                            })
                            return;
                        } else {
                            var isMembar = false
                            for(var i = 0; i < group.members.length; i++) {
                                var member = group.members[i]
                                
                                if(member._id.toString() == user._id.toString()) {
                                    isMembar = true
                                    break
                                }
                            }
                            if(!isMembar) {
                                res.json({
                                    status: 'error',
                                    message: 'Sorry, You Do Not Own This Page '
                                })
                                return
                            }
                            db.collection('posts').insertOne({
                                caption,
                                image,
                                video,
                                type,
                                createdAt,
                                likers: [],
                                comments: [],
                                shares:[],
                                user: {
                                    _id: group._id,
                                    name:group.name,
                                    profileImage: group.coverPhoto
                                },
                                uploader:{
                                    _id: user._id,
                                    name: user.name,
                                    profileImage: user.profileImage
                                }
                            }, (error, data) => {
                                res.json({
                                    status: 'success',
                                    message: 'Post Has Been Uploaded'
                                })
                                
                            })
                        }
                    })
                } else {
                    db.collection("posts").insertOne({
                        caption,
                        image,
                        video,
                        type,
                        createdAt,
                        "likers": [],
                        "comments": [],
                        "shares": [],
                        "user": {
                            "_id": user._id,
                            "name": user.name,
                            "username": user.username,
                            "profileImage": user.profileImage
                        }
                    }, (error, result) => {
                        db.collection("users").updateOne({accessToken},{
                            $push: {
                                "posts": {
                                    "_id": result.insertedId,
                                    caption,
                                    image,
                                    video,
                                    type,
                                    createdAt,
                                    "likers": [],
                                    "comments": [],
                                    "shares": []
                                }
                            }
                        }, (error, data) =>{
                            res.json({
                                "status": "success",
                                "message": "Post has been uploaded."
                            });
                        });
                    })
                }
            }
        })
    })
    app.post('/getNewsfeed', (req, res) => {
        var accessToken = req.fields.accessToken;
        db.collection("users").findOne({accessToken}, (error, user) => {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                var ids = [];

                ids.push(user._id);
                for(var a = 0; a < user.pages.length; a++ )
                    ids.push(user.pages[a]._id)

                for(var i = 0; i < user.groups.length; i++){
                    if(user.groups[i].status == 'Accepted')
                        ids.push(user.groups[i]._id)
                }
                
                for(var i = 0; i < user.friends.length; i++) 
                    ids.push(user.friends[i]._id)
                    
                db.collection("posts")
                .find({
                    "user._id": {
                        $in: ids
                    }
                })
                .sort({
                    "createdAt": -1
                })
                .limit(20)
                .toArray( (error, data) => {
                    res.json({
                        "status": "success",
                        "message": "Record has been fetched",
                        "data": data
                    });
                });
            }
        });
    })
    app.post('/toggleLikePost', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = req.fields._id
        db.collection("users").findOne({accessToken}, (error, user) => {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                db.collection('posts').findOne({
                    '_id': ObjectId(_id)
                }, (error, post) => {
                    if(post == null) {
                        res.json({
                            status: 'error',
                            message: 'Post Does Not Exits'
                        })
                    } else {
                        var isLiked = false
                        for(var i=0; i< post.likers.length; i++) {
                            var liker = post.likers[i]

                            if(liker._id.toString() == user._id.toString()) {
                                isLiked = true
                                break
                            }
                        }
                        if(isLiked) {
                            db.collection('posts').updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $pull: {
                                    "likers": {"_id": user._id}
                                }
                            }, (error, result) => {
                                db.collection('users').updateOne({
                                    $and: [
                                        {'_id': post.user._id},
                                        {'posts._id': post._id}] 
                                    },{
                                        $pull: {
                                            'posts.$[].likers': {
                                                '_id':user._id,
                                            }
                                        }
                                }, (error, result) => {
                                    res.json({
                                        status: 'unliked',
                                        message: 'Post Has Been Unliked'
                                    })
                                })
                                
                            })
                           
                        } else {
                            db.collection("users").updateOne({
                                "_id": post.user._id
                            }, {
                                $push: {
                                    "notifications": {
                                        "_id": ObjectId(),
                                        "type": "photo_liked",
                                        "content": user.name + " has liked your post.",
                                        "profileImage": user.profileImage,
                                        "isRead": false,
                                        "post": {
                                            "_id": post._id
                                        },
                                        "createdAt": new Date().getTime()
                                    }
                                }
                            });

                            db.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "likers": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage
                                    }
                                }
                            }, (error, data) => {

                                db.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].likers": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage
                                        }
                                    }
                                });
                                res.json({
                                    "status": "success",
                                    "message": "Post has been liked."
                                });
                            });
                        }
                    }
                })
            }
        })
    })
    app.post('/postComment', (req, res) => {
        var accessToken = req.fields.accessToken;
        var _id = ObjectId(req.fields._id);
        var comment = req.fields.comment;
        var createdAt = new Date().getTime();

        db.collection("users").findOne({accessToken}, (error, user) => {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                db.collection("posts").findOne({_id}, (error, post) => {
                    if (post == null) {
                        res.json({
                            "status": "error",
                            "message": "Post does not exist."
                        });
                    } else {
                        var commentId = ObjectId();
                        db.collection("posts").updateOne({_id},{
                            $push: {
                                "comments": {
                                    "_id": commentId,
                                    "user": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage,
                                    },
                                    "comment": comment,
                                    "createdAt": createdAt,
                                    "replies": []
                                }
                            }
                        }, (error, data) => {
                            if (user._id.toString() != post.user._id.toString()) {
                                db.collection("users").updateOne({
                                    "_id": post.user._id
                                }, {
                                    $push: {
                                        "notifications": {
                                            "_id": ObjectId(),
                                            "type": "new_comment",
                                            "content": user.name + " commented on your post.",
                                            "profileImage": user.profileImage,
                                            "post": {
                                                "_id": post._id
                                            },
                                            "isRead": false,
                                            "createdAt": new Date().getTime()
                                        }
                                    }
                                });
                            }

                            db.collection("users").updateOne({
                                $and: [{
                                    "_id": post.user._id
                                }, {
                                    "posts._id": post._id
                                }]
                            }, {
                                $push: {
                                    "posts.$[].comments": {
                                        "_id": commentId,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                        },
                                        "comment": comment,
                                        "createdAt": createdAt,
                                        "replies": []
                                    }
                                }
                            });

                            db.collection("posts").findOne({_id}, (error, updatePost) => {
                                res.json({
                                    "status": "success",
                                    "message": "Comment has been posted.",
                                    "updatePost": updatePost
                                });
                            });
                        });
                    }
                })
            }
        })
    })
    app.post('/postReplay', (req, res) => {
        var accessToken = req.fields.accessToken
        var postId = req.fields.postId
        var commentId = req.fields.commentId
        var reply = req.fields.reply
        var createdAt = new Date().getTime()

        db.collection('users').findOne({accessToken}, (error, user) => {
            if(user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                db.collection("posts").findOne({
                    "_id": ObjectId(postId)
                }, (error, post) => {
                    if (post == null) {
                        res.json({
                            "status": "error",
                            "message": "Post does not exist."
                        });
                    } else {
                        var replyId = ObjectId();
                        db.collection("posts").updateOne({
                            $and: [{
                                "_id": ObjectId(postId)
                            }, {
                                "comments._id": ObjectId(commentId)
                            }]
                        }, {
                            $push: {
                                "comments.$.replies": {
                                    "_id": replyId,
                                    "user": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage,
                                    },
                                    "reply": reply,
                                    "createdAt": createdAt
                                }
                            }
                        },  (error, data) => {
                            db.collection("users").updateOne({
                                $and: [{
                                    "_id": post.user._id
                                }, {
                                    "posts._id": post._id
                                }, {
                                    "posts.comments._id": ObjectId(commentId)
                                }]
                            }, {
                                $push: {
                                    "posts.$[].comments.$[].replies": {
                                        "_id": replyId,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                        },
                                        "reply": reply,
                                        "createdAt": createdAt
                                    }
                                }
                            })

                            db.collection("posts").findOne({
                                "_id": ObjectId(postId)
                            }, function (error, updatePost) {
                                res.json({
                                    "status": "success",
                                    "message": "Reply has been posted.",
                                    "updatePost": updatePost
                                })
                            })
                        })
                    }
                })
            }
        })
    })
    app.post('/sharePost', (req, res) => {
        var accessToken = req.fields.accessToken;
        var _id = req.fields._id;
        var type = "shared";
        var createdAt = new Date().getTime();

        db.collection("users").findOne({accessToken},(error, user) => {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                db.collection("posts").findOne({
                    "_id": ObjectId(_id)
                }, function (error, post) {
                    if (post == null) {
                        result.json({
                            "status": "error",
                            "message": "Post does not exist."
                        });
                    } else {

                        db.collection("posts").updateOne({
                            "_id": ObjectId(_id)
                        }, {
                            $push: {
                                "shares": {
                                    "_id": user._id,
                                    "name": user.name,
                                    "profileImage": user.profileImage
                                }
                            }
                        }, (error, data) => {

                            db.collection("posts").insertOne({
                                "caption": post.caption,
                                "image": post.image,
                                "video": post.video,
                                "type": type,
                                "createdAt": createdAt,
                                "likers": [],
                                "comments": [],
                                "shares": [],
                                "user": {
                                    "_id": user._id,
                                    "name": user.name,
                                    "gender": user.gender,
                                    "profileImage": user.profileImage
                                }
                            }, (error, data) => {

                                db.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].shares": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage
                                        }
                                    }
                                });

                                res.json({
                                    "status": "success",
                                    "message": "Post has been shared."
                                });
                            });
                        });
                    }
                });
            }
        })
    })
    app.get('/search/:query', (req, res) => {
        var query = req.params.query
        res.render('search',{query})
    })
    app.post('/search', (req, res) => {
        var query = req.fields.query;
        db.collection("users").find({
            "name": {
                $regex: ".*" + query + ".*",
                $options: "i"
            }
        }).toArray((error, data) => {
            db.collection('pages').find({
                "name": {
                    $regex: ".*" + query + ".*",
                    $options: "i"
                }
            }).toArray((error, pages) => {
                db.collection('groups').find({
                    name: {
                        $regex: ".*" + query + ".*",
                        $options: "i"
                    }
                }).toArray((error, groups) => {
                    res.json({
                        "status": "success",
                        "message": "Record has been fetched",
                        data,
                        pages,
                        groups
                    });
                })
            })
        });
    })
    app.post('/sendFriendRequest', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
    
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                var me = user
                db.collection("users").findOne({_id},(error, user) =>  {
                    if (user == null) {
                        res.json({
                            "status": "error",
                            "message": "User Does Not Exist."
                        });
                    } else {
                        db.collection('users').updateOne({_id},{
                            $push:{
                                'friends': {
                                    _id: me._id,
                                    name: me.name,
                                    profileImage: me.profileImage,
                                    status: 'pending',
                                    sentByMe: false,
                                    inbox:[]
                                }
                            }
                        }, (error, data) => {
                            db.collection('users').updateOne({_id: me._id},
                            {
                                $push: {
                                    'friends': {
                                        _id: user._id,
                                        name: user.name,
                                        profileImage: user.profileImage,
                                        status: 'pending',
                                        sentByMe: false,
                                    }
                                }   
                            }, (error, data) => {
                                res.json({
                                    status: 'success',
                                    message: 'Friend Request Has Benn Sent'
                                })
                            })
                        })
                    }
                })
            }
        })
    })
    app.get('/friends', (req, res) => {
        res.render('friends')
    })
    app.post('/acceptFritendRequest', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
    
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                var me = user
                db.collection("users").findOne({_id},(error, user) =>  {
                    if (user == null) {
                        res.json({
                            "status": "error",
                            "message": "User Does Not Exist."
                        });
                    } else {
                        db.collection('users').updateOne({_id},{
                            $push: {
                                'notifications': {
                                    _id: ObjectId(),
                                    type: 'friend_request_accepted',
                                    content: `${me.name} Accepted Your Friend Request`,
                                    profileImage: me.profileImage,
                                    createdAt: new Date().getTime()
                                }
                            }
                        })
                        db.collection('users').updateOne(
                        {
                            $and: [{_id},{'friends._id': me._id}],
                        },
                        {
                            $set: {'friends.$.status': 'Accepted'}
                        }, (error, data) => {
                            db.collection('users').updateOne({
                                $and: [{_id:me._id},{'friends._id': user._id}],
                            },
                            {
                                $set: {'friends.$.status': 'Accepted'}
                            },(error, result) => {
                                res.json({
                                    status: 'success',
                                    message: 'Friend Request Has Benn Accepted.'
                                })
                            })
                        })
                    }
                })
            }
        })
    })
    app.post('/unfriend', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
    
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                var me = user
                db.collection("users").findOne({_id},(error, user) =>  {
                    if (user == null) {
                        res.json({
                            "status": "error",
                            "message": "User Does Not Exist."
                        });
                    } else {
                        db.collection('users').updateOne({_id},{
                            $pull: {
                                'friends': {
                                    _id: me._id
                                }
                            }
                        }, (error, data) => {
                            db.collection('users').updateOne({_id: me._id},{
                                $pull: {
                                    'friends': {
                                        _id: user._id
                                    }
                                }
                            }, (error, data) => {
                                res.json({
                                    "status": "error",
                                    "message": "Friend Has Been Removed"
                                });
                            })
                        })
                    }
                })
            }
        })
    })
    app.get('/inbox', (req, res) => {
        res.render('inbox')
    })
    app.post('/getFriendsChat', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = req.fields._id
    
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } else {
                var index = user.friends.findIndex(friend => friend._id == _id)
                var inbox = user.friends[index].inbox
                res.json({
                    status: 'success',
                    message: 'Record Has Been Sent',
                    data: inbox
                })
            }
        })
    })
    app.post('/sendMessage', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
        var message = req.fields.message

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                var me = user
                db.collection('users').findOne({_id}, (error, user) => {
                    if(user == null)
                    {
                        res.json({
                            status: 'error',
                            message: 'User Does Not Exist.'
                        })
                    } 
                    else {
                        db.collection('users').updateOne(
                        {
                            $and: [{_id}, {'friends._id': me._id}]
                        },
                        {
                            $push: {
                                'friends.$.inbox': {
                                    _id: ObjectId(),
                                    message,
                                    from: me._id
                                }
                            }
                        }, (error, data) => {
                            db.collection('users').updateOne(
                            {
                                $and: [{'_id':me._id}, {'friends._id': user._id}]
                            },
                            {
                                $push: {
                                    'friends.$.inbox': {
                                        _id: ObjectId(),
                                        message,
                                        from: me._id
                                    }
                                }
                            },(error, data) => {
                                
                                socketIO.to(users[user._id]).emit('messageReceived', {
                                    message,
                                    from : me._id
                                })

                                res.json({
                                    status: 'success',
                                    message: 'Message Has Benn Sent.'
                                })
                            })
                        })
                    }
                })
            }
        })
    })
    app.post('/connectSocket', (req, res) => {
        var accessToken = req.fields.accessToken
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                users[user._id] = socketId
                res.json({
                    status: 'status',
                    message: 'Socket Has Been Connected'
                })
            }
        })
    })
    app.get('/createPage', (req, res) => {
        res.render('createPage')
    })
    app.post('/createPage', (req, res) => {
        var accessToken = req.fields.accessToken
        var name = req.fields.name
        var domainName = req.fields.domainName
        var additionalInfo = req.fields.additionalInfo
        var coverPhoto = ''

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                if (req.files.coverPhoto.size > 0 && req.files.coverPhoto.type.includes("image")) {
                    coverPhoto = "public/images/" + new Date().getTime() + "-" + req.files.coverPhoto.name;
                    moveFile(req.files.coverPhoto.path, coverPhoto,error => error?console.log(error):'');
                
                    db.collection('pages').insertOne({
                        name,
                        domainName,
                        additionalInfo,
                        coverPhoto,
                        likers:[],
                        user: {
                            _id: user._id,
                            name: user.name,
                            profileImage: user.profileImage
                        }
                    }, (error, data) => {
                        res.json({
                            status: 'success',
                            message: 'Page Has Been Created.'
                        })
                    })
                }  else {
                    res.json({
                        status: 'error',
                        message: 'Please Select A Cover Photo.'
                    })
                }
            }
        })
    })
    app.get('/pages', (req, res) => {
        res.render('pages')
    })
    app.post('/getPages', (req, res) => {
        var accessToken = req.fields.accessToken
        
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('pages').find({
                    $or:[{'user._id': user._id},
                        {'likers._id': user._id}]
                }).toArray((error, data) => {
                    res.json({
                        status: 'success',
                        message: 'Record Has Been Fetched',
                        data
                    })
                })
            }
        })
    })
    app.get('/page/:_id', (req, res) => {
        var _id = ObjectId(req.params._id)

        db.collection('pages').findOne({_id}, (error, page) => {
            if(page == null) {
                res.json({
                    status: 'error',
                    message: 'Pages Does Not Exist'
                })
            } else {
                res.render('singlePage', {_id})
            }
        })
    })
    app.post('/getPageDetail', (req, res) => {
        var _id = ObjectId(req.fields._id)
        db.collection('pages').findOne({_id}, (error, page) => {
            if(page == null) {
                res.json({
                    status: 'error',
                    message: 'Pages Does Not Exist'
                })
            } else {
                db.collection('posts').find({
                    $and:[{'user._id': page._id},
                        {'type': 'page_post'}]
                }).toArray((error, posts) => {
                    res.json({
                        status: 'success',
                        message: 'Record Has Been Fetched.',
                        data: page,
                        posts
                    })
                })
            }
        })
    })
    app.post('/toggleLikePage', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId( req.fields._id)

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('pages').findOne({_id}, (error, page) => {
                    if(page == null) {
                        res.json({
                            status: 'error',
                            message: 'Pages Does Not Exist'
                        })
                    } else {
                        var isLiked = false 
                        for(var i = 0 ; i < page.likers.length; i++) {
                            var liker = page.likers[i]

                            if(liker._id.toString() == user._id.toString()) {
                                isLiked = true
                                break
                            }
                        }
                        if(isLiked) {
                            db.collection('pages').updateOne({_id}, {
                                $pull: {
                                    'likers': {_id: user._id}
                                }
                            }, (error, data) => {
                                db.collection('users').updateOne({accessToken}, {
                                    $pull: {
                                        pages: {_id}
                                    }
                                }, (error, data) => {
                                    res.json({
                                        status: 'unliked',
                                        message: 'Page Has Been Unliked'

                                    })
                                })
                            })
                        } else {
                            db.collection('pages').updateOne({_id}, {
                                $push: {
                                    likers: {
                                        _id: user._id,
                                        name: user.name,
                                        profileImage: user.profileImage
                                    }
                                }
                            }, (error, data) => {
                                db.collection('users').updateOne({accessToken}, {
                                    $push: {
                                        pages: {
                                            _id: page._id,
                                            name: page.name,
                                            coverPhoto: page.coverPhoto
                                        }
                                    }
                                }, (error, data) => {
                                    res.json({
                                        status: 'success',
                                        message: 'Page Has Been Liked'
                                    })
                                })
                            })
                        }
                    }
                })
            }
        })
    })
    app.post('/getMyPages', (req, res) => {
        var accessToken = req.fields.accessToken

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('pages').find({
                    'user._id': user._id
                }).toArray((error, data) => {
                    res.json({
                        status: 'success',
                        message: 'Record Has Benn Featchd',
                        data
                    })
                })
            }
        })
    })
    app.get('/createGroup', (req, res) => {
        res.render('createGroup')
    })
    app.post('/createGroup', (req, res) => {
        var accessToken = req.fields.accessToken
        var name = req.fields.name
        var additionalInfo = req.fields.additionalInfo
        var coverPhoto = ''

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                if (req.files.coverPhoto.size > 0 && req.files.coverPhoto.type.includes("image")) {
                    coverPhoto = "public/images/" + new Date().getTime() + "-" + req.files.coverPhoto.name;
                    moveFile(req.files.coverPhoto.path, coverPhoto,error => error?console.log(error):'');
                
                    db.collection('groups').insertOne({
                        name,
                        additionalInfo,
                        coverPhoto,
                        members:[{
                            _id: user._id,
                            name: user.name,
                            profileImage: user.profileImage,
                            status: 'Accepted'
                        }],
                        user: {
                            _id: user._id,
                            name: user.name,
                            profileImage: user.profileImage
                        }
                    }, (error, data) => {
                        db.collection('users').updateOne({accessToken},{
                            $push: {
                                groups: {
                                    _id: data.insertedId,
                                    name,
                                    coverPhoto,
                                    status: 'Accepted'  
                                }
                            }
                        }, (error, data) => {
                            res.json({
                                status: 'success',
                                message: 'Group Has Been Created.'
                            })
                        })
                    })
                }  else {
                    res.json({
                        status: 'error',
                        message: 'Please Select A Cover Photo.'
                    })
                }
            }
        })
    })
    app.get('/groups', (req, res) => {
        res.render('groups')
    })
    app.post('/getGroups', (req, res) => {
        var accessToken = req.fields.accessToken
        
        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('groups').find({
                    $or:[{'user._id': user._id},
                        {'members._id': user._id}]
                }).toArray((error, data) => {
                    res.json({
                        status: 'success',
                        message: 'Record Has Been Fetched',
                        data
                    })
                })
            }
        })
    })
    app.get('/group/:_id', (req, res) => {
        var _id = ObjectId(req.params._id)

        db.collection('groups').findOne({_id}, (error, page) => {
            if(page == null) {
                res.json({
                    status: 'error',
                    message: 'Groups Does Not Exist'
                })
            } else {
                res.render('singleGroup', {_id})
            }
        })
    })
    app.post('/getGroupDetail', (req, res) => {
        var _id = ObjectId(req.fields._id)
        db.collection('groups').findOne({_id}, (error, group) => {
            if(group == null) {
                res.json({
                    status: 'error',
                    message: 'Group Does Not Exist'
                })
            } else {
                db.collection('posts').find({
                    $and:[{'user._id': group._id},
                        {'type': 'group_post'}]
                }).toArray((error, posts) => {
                    res.json({
                        status: 'success',
                        message: 'Record Has Been Fetched.',
                        data: group,
                        posts
                    })
                })
            }
        })
    })
    app.post('/toggleJoinGroup', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('groups').findOne({_id}, (error, group) => {
                    if(group == null) {
                        res.json({
                            status: 'error',
                            message: 'Group Does Not Exist'
                        })
                    } else {
                        var isMember = false 
                        for(var i = 0 ; i < group.members.length; i++) {
                            var member = group.members[i]

                            if(member._id.toString() == user._id.toString()) {
                                isMember = true
                                break
                            }
                        }
                        if(isMember) {
                            db.collection('groups').updateOne({_id}, {
                                $pull: {
                                    'members': {_id: user._id}
                                }
                            }, (error, data) => {
                                db.collection('users').updateOne({_id: group.user._id},{
                                    $pull: {
                                        'notifications': {userId:user._id}
                                    }
                                })
                                db.collection('users').updateOne({accessToken}, {
                                    $pull: {
                                        groups: {_id}
                                    }
                                }, (error, data) => {
                                    res.json({
                                        status: 'leaved',
                                        message: 'Group Has Been Left'

                                    })
                                })
                            })
                        } else {
                            db.collection('groups').updateOne({_id}, {
                                $push: {
                                    members: {
                                        _id: user._id,
                                        name: user.name,
                                        profileImage: user.profileImage,
                                        status: 'pending'
                                    }
                                }
                            }, (error, data) => {
                                db.collection('users').updateOne({accessToken}, {
                                    $push: {
                                        groups: {
                                            _id: group._id,
                                            name: group.name,
                                            coverPhoto: group.coverPhoto,
                                            status: 'pending'
                                        }
                                    }
                                }, (error, data) => {
                                    db.collection('users').updateOne({_id: group.user._id},{
                                        $push: {
                                            notifications: {
                                                _id: ObjectId(),
                                                type:'group_join_request',
                                                content: user.name + " sent a Request To Join Your Group",
                                                profileImage: user.profileImage,
                                                userId: user._id,
                                                groupId: group._id,
                                                status: 'pending',
                                                createdAt: new Date().getTime()
                                            }
                                        }
                                    })
                                    res.json({
                                        status: 'success',
                                        message: 'Request To Join Group Has Benn Sent.'
                                    })
                                })
                            })
                        }
                    }
                })
            }
        })
    })
    app.get('/notifications', (req, res) => {
        res.render('notifications')
    })
    app.post('/acceptRequestJoinGroup', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
        var userId = ObjectId(req.fields.userId)
        var groupId = ObjectId(req.fields.groupId) 

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('groups').findOne({_id: groupId}, (error, group) => {
                    if(group == null) {
                        res.json({
                            status: 'error',
                            message: 'Group Does Not Exist'
                        })
                    } else {

                        if(group.user._id.toString() != user._id.toString()) {
                            res.json({
                                status:'error',
                                message: 'Sorry You Do not Own this Group'
                            })
                            return
                        }

                        db.collection('groups').updateOne({
                            $and:[{_id: group._id},{'members._id':userId}]
                        },{
                            $set:{'members.$.status': 'Accepted'}
                        }, (error, data) => {

                            db.collection('users').updateOne({
                                $and: [{accessToken},{'notifications.groupId': group._id}]
                            }, {
                                $set: {'notifications.$.status': 'Accepted'}
                            }, (error, data) => {

                                db.collection('users').updateOne({
                                    $and:[{_id:userId}, {'groups._id': group._id}]
                                },
                                {
                                    $set: {'groups.$.status': 'Accepted'}
                                }, (error, data) => {
                                    res.json({
                                        status: 'success',
                                        message: 'Group Join Request Has Been Accepted'
                                    })
                                })
                            })
                        })
                    }
                })
            }
        })
    })
    app.post('/rejectRequestJoinGroup', (req, res) => {
        var accessToken = req.fields.accessToken
        var _id = ObjectId(req.fields._id)
        var userId = ObjectId(req.fields.userId)
        var groupId = ObjectId(req.fields.groupId) 

        db.collection("users").findOne({accessToken},(error, user) =>  {
            if (user == null) {
                res.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });
            } 
            else {
                db.collection('groups').findOne({_id: groupId}, (error, group) => {
                    if(group == null) {
                        res.json({
                            status: 'error',
                            message: 'Group Does Not Exist'
                        })
                    } else {
                        if(group.user._id.toString() != user._id.toString()) {
                            res.json({
                                status:'error',
                                message: 'Sorry You Do not Own this Group'
                            })
                            return
                        }

                        db.collection('groups').updateOne({_id: group._id},{
                            $pull: {
                                members: {
                                    _id: userId
                                }
                            }
                        }, (error, data) => {
                            db.collection('users').updateOne({accessToken},{
                                $pull: {
                                    'notifications': {userId}
                                }
                            }, (error, data) => {
                                db.collection('users').updateOne({_id: userId}, {
                                    $pull: {
                                        'groups': {
                                            _id: group._id
                                        }
                                    }
                                }, (error, data) => {
                                    res.json({
                                        status: 'success',
                                        message: 'Group Join Request Has Benn Rejected'
                                    })
                                })
                            })
                        })
                    }
                })
            }
        })
    })
})