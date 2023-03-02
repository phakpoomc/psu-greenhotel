import express from 'express';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { JsonDB, Config } from 'node-json-db';
import sessions from 'express-session';
import crypto from 'crypto';
import expressVisitorCounter from 'express-visitor-counter';

var db = new JsonDB(new Config("psu-db", true, false, '/'));

var data = await db.getData('/');

var currentID = data.currentID || 0;

var rootdir = process.cwd();
var rootpath = "/psu-demo/"; //"/psu-demo/"
var svname = "se-sskru.com-";

var jsonForm = "";

var counters = data.counters || {};

fs.readFile('standardindex.json', 'utf8', (err, data) => {
    if (err) throw err;
    let jsonData = JSON.parse(data);
    jsonForm = jsonData;
});

const createRecursiveDirectories = (dir) => {
    if (!fs.existsSync(dir)) {
        // if parent directory does not exist create it recursively
        createRecursiveDirectories(path.dirname(dir));
        // create the directory
        fs.mkdirSync(dir);
    }
}

const moveFile = (src, dest, filename) => {
    createRecursiveDirectories(dest);

    // move the file to the destination folder
    fs.rename(src, path.join(dest, filename), (err) => {
        if (err) throw err;
        console.log('File moved successfully.');
    });
}

function generateUserId() {
    return crypto.randomBytes(5).toString('hex');
}
  
  function generatePassword() {
    return crypto.randomBytes(8).toString('hex');
}

async function updateCounter(counterId)
{
    counters[counterId] = (counters[counterId] || 0) + 1;
    await db.push('/counter', counters, false);
}

const app = express();
app.enable('trust proxy');
app.use(sessions({
    secret: 'PSUgr33nh0tel53cr3tkEy',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000*60*60*24*7, secure: false, httpOnly: true }
}));
app.use(expressVisitorCounter({hook: updateCounter}));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    let coaching = fs.readdirSync('./img/coaching');
    let workshop = fs.readdirSync('./img/workshop');
    let fieldtrip = fs.readdirSync('./img/fieldtrip');
    let openning = fs.readdirSync('./img/openning');
    let certificate = fs.readdirSync('./img/certificate');
    let training = fs.readdirSync('./img/training');

    let date = new Date();
    let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()

    console.log(key);

    console.log(counters);

    res.render('./pages/index.ejs', {
        coaching: coaching,
        workshop: workshop,
        fieldtrip: fieldtrip,
        openning: openning,
        certificate: certificate,
        training: training,
        rootpath: rootpath,
        visitor: counters[key] || 1
    });
});

app.get('/loginform', (req, res) => {
    if(req.session.userid == null)
    {
        res.render('./pages/login', {rootpath: rootpath});
    }
    else
    {
        req.session.destroy();
        res.redirect(rootpath);
    }
});

app.post('/login', async (req, res) => {
    let users = await db.getData('/users');

    const form = new formidable.IncomingForm();
  
    form.parse(req, async (err, fields, files) => {
        if (err) {
            next(err);
            return;
        }

        let ID = fields.id;
        let password = fields.password;

        if(users.hasOwnProperty(ID) && password == users[ID].info.password)
        {
            req.session.userid = users[ID].info.username;
            req.session.privilege = users[ID].info.privilege;
            req.session.save();
            
            res.redirect(rootpath+'userform');
        }
        else
        {
            res.send("Invalid username or password");
        }
    });
});

app.get('/createAccount', async (req, res) => {
    let session = req.session;

    if(session.userid != null && session.privilege == "admin")
    {
        let users = await db.getData('/users');
        let forms = {};
        let sidebarList = {};
        let date = new Date();
        let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()


        for(let user of Object.getOwnPropertyNames(users))
        {
            if(users[user]['form'] != null)
            {
                sidebarList[users[user].info.username] = true;
            }

            forms[users[user].info.username] = users[user].info;
        }


        res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, userList: forms, showUser: -1, rootpath: rootpath, visitor: counters[key] || 1});
    }
    else
    {
        res.redirect(rootpath);
    }
});

app.post('/updatePassword', async (req, res) => {
    let session = req.session;

    if(session.userid != null && session.privilege == "admin")
    {
        const form = new formidable.IncomingForm();
  
        form.parse(req, async (err, fields, files) => {
            if (err) {
                next(err);
                return;
            }

            let username = fields.username;
            let password = fields.password;
			let pattern = /\W/;

            if(username && username.length > 4 && !pattern.test(username) && password && password.length > 6 && !pattern.test(password))
            {
		        await db.push('/users/' + username + '/info/password', password, false);
		        
	        }
	        res.redirect(rootpath + 'createAccount');
	        
        });


    }
    else
    {
        res.redirect(rootpath);
    }
});

app.get('/removeAccount/:username', async (req, res) => {
    data = await db.getData('/');
    currentID = data.currentID + 1;

    if(req.session.userid != null && req.session.privilege == "admin")
    {
        await db.delete('/users/' + req.params.username);

        res.redirect(rootpath+'createAccount');
    }
    else
    {
        res.redirect(rootpath);
    }
});

app.post('/createAccount', async (req, res, next) => {
    if(req.session.userid != null && req.session.privilege == "admin")
    {
        const form = new formidable.IncomingForm();
  
        form.parse(req, async (err, fields, files) => {
            if (err) {
                next(err);
                return;
            }

            let username = fields.username;
            let password = fields.password;
            let pattern = /\W/;

            if(username && username.length > 4 && !pattern.test(username) && password && password.length > 6 && !pattern.test(password))
            {
                await db.push('/users/' + username + '/info', {"username": username, "password": password, "id": ++currentID, "privilege": "user"}, false);
                await db.push('/currentID', currentID);

                res.redirect(rootpath+'createAccount');
            }
            else
            {
                res.redirect(rootpath+'createAccount');
            }
            
        });
    }
    else
    {
        res.redirect(rootpath);
    }
});

app.get('/userform', async (req, res) => {
    let session = req.session;

    if(session.userid != null)
    {
        if(session.privilege == "admin")
        {
            res.redirect(rootpath+'adminform');
        }
        else
        {
            let data = await db.getData('/users/' + session.userid);
            let date = new Date();
            let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()


            if(data['form'] == null)
            {
                res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, result: null, rootpath: rootpath, submit: false, visitor: counters[key] || 1});
            }
            else
            {
                res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, result: null, rootpath: rootpath, submit: true, visitor: counters[key] || 1});
            }
        }
    }
    else
    {
        res.redirect(rootpath+'loginform');
    }    
});

app.get('/userresult', async (req, res) => {
    let session = req.session;

    if(session.userid != null)
    {
        if(session.privilege == "admin")
        {
            res.redirect(rootpath+'adminform');
        }
        else
        {
            let data = await db.getData('/users/' + session.userid);
            let date = new Date();
            let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()


            if(data['result'] != null)
            {
                res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, forms: data['form'], result: data['result'], rootpath: rootpath, visitor: counters[key] || 1});
            }
            else
            {
                res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, forms: data['form'], result: "noresult", rootpath: rootpath, visitor: counters[key] || 1});
            }
            
        }
    }
    else
    {
        res.redirect(rootpath+'loginform');
    }  
});

app.get('/adminform', async (req, res) => {
    let session = req.session;

    if(session.userid != null && session.privilege == "admin")
    {
        let users = await db.getData('/users');
        let sidebarList = {};
        let date = new Date();
        let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()


        for(let user of Object.getOwnPropertyNames(users))
        {
            if(users[user]['form'] != null)
            {
                sidebarList[users[user].info.username] = true;
            }
        }

        res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, data: jsonForm, showUser: null, rootpath: rootpath, visitor: counters[key] || 1});
    }
    else
    {
        res.redirect(rootpath);
    }
});

app.get('/adminform/:userid', async (req, res) => {
    let session = req.session;

    if(session.userid != null && session.privilege == "admin")
    {
        let users = await db.getData('/users');

        let sidebarList = {};

        for(let user of Object.getOwnPropertyNames(users))
        {
            if(users[user]['form'] != null)
            {
                sidebarList[users[user].info.username] = true;
            }
        }

        if(users.hasOwnProperty(req.params.userid))
        {
            if(users[req.params.userid]['form'] != null)
            {
                let formChecked = false;
                let date = new Date();
                let key = svname+'visitors-'+("0" + date.getDate()).slice(-2)+'-'+String(("0" + (date.getMonth() + 1)).slice(-2))+'-'+date.getFullYear()


                if(users[req.params.userid]['result'] != null)
                {
                    formChecked = true;
                }

                res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, forms: users[req.params.userid]['form'], data: jsonForm, showUser: req.params.userid, checked: formChecked, rootpath: rootpath, visitor: counters[key] || 1});
            }
            else
            {
                res.redirect(rootpath+'adminform');
            }
        }
        else
        {
            res.redirect(rootpath+'adminform');
        }
        
    }
    else
    {
        res.redirect(rootpath);
    }
});

app.get('/reset', async (req, res) => {
    await db.delete('/users');
    await db.delete('/currentID');
    await db.push('/users/admin/info', {"username": "admin", "password": "psuadmin", "id": 0, "privilege": "admin"});

    currentID = 0;

    res.send('OK');
});

app.post('/submit/:username', async (req, res, next) => {
    if(req.session.userid == null || req.session.privilege != "admin")
    {
        res.send("Your session expired. Login and retry.");
    }

    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            next(err);
            return;
        }

        let einfo = {};
        
        // Handle fields
        for(const [key, value] of Object.entries(fields))
        {
            einfo[key] = value;
        }

        await db.push('/users/'+ req.params.username + '/result', einfo, true);

        data = await db.getData('/');

        res.redirect(rootpath+'adminform');
    });
});

app.post('/resubmit', async (req, res, next) => {
    if(req.session.userid == null)
    {
        res.send("Your session expired. Login and retry.");
    }
    else
    {
        if(req.session.privilege == "admin")
        {
            const form = new formidable.IncomingForm();
  
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    next(err);
                    return;
                }

                let userid = fields.userid;
                await db.delete('/users/' + userid + '/result');
                
            });

            res.redirect(rootpath + 'adminform');
        }
        else
        {
            await db.delete('/users/' + req.session.userid + '/form');
            await db.delete('/users/' + req.session.userid + '/result');

            res.redirect(rootpath + 'userform');
        }
    }
    
    
});

app.post('/submit', async (req, res, next) => {

    if(req.session.userid == null)
    {
        res.send("Your session expired. Login and retry.");
    }

    const form = formidable({ 
        multiples: true,
        hashAlgorithm: 'sha1', 
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            next(err);
            return;
        }

    let uinfo = {};

    uinfo.id = req.session.userid;
    uinfo.name = fields.name;

    // Handle fields
    for(const [key, value] of Object.entries(fields))
    {
        uinfo[key] = value;
    }

    // Handle files
    let root = './uploads/' + uinfo.id + '/';

    for(const [key, value] of Object.entries(files))
    {
        if(Array.isArray(value))
        {
            uinfo[key] = [];

            for(const [k, v] of Object.entries(value))
            {
                if(v.hash != 'da39a3ee5e6b4b0d3255bfef95601890afd80709')
                {
                    let p = path.join(root, key);

                    moveFile(v.filepath, p, v.originalFilename);
                    uinfo[key].push({'path': path.join(p, v.originalFilename), 'hash': v.hash, 'mime-type': v.mimetype});
                }
                else
                {
                    uinfo[key] = {'path': '', 'hash': 'da39a3ee5e6b4b0d3255bfef95601890afd80709', 'mime-type': null};
                }
            }
        }
        else
        {
            if(value.hash != 'da39a3ee5e6b4b0d3255bfef95601890afd80709')
            {
                let p = path.join(root, key);

                moveFile(value.filepath, p, value.originalFilename);
                uinfo[key] = {'path': path.join(p, value.originalFilename), 'hash': value.hash, 'mime-type': value.mimetype};
            }
            else
            {
                uinfo[key] = {'path': '', 'hash': 'da39a3ee5e6b4b0d3255bfef95601890afd80709', 'mime-type': null};
            }
        }
    }

    await db.push('/users/'+ uinfo.id + '/form', uinfo, true);

    data = await db.getData('/');

    res.redirect(rootpath+'userform');
  });
});

app.get('/css/:cssname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'text/css; charset=UTF-8'
        }
    };

    res.sendFile('./src/css/' + req.params.cssname, options);
})

app.get('/js/:jsname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'text/javascript; charset=UTF-8'
        }
    };

    res.sendFile('./src/js/' + req.params.jsname, options);
})

app.get('/img/:imgname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'image/png'
        }
    };

    res.sendFile('./img/' + req.params.imgname, options);
})

app.get('/img/:subfolder/:imgname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'image/jpeg'
        }
    };

    res.sendFile('./img/' + req.params.subfolder + '/' + req.params.imgname, options);
})

app.get('/uploads/:username/:index/:imgname', (req, res) => {
    let contentType = "";
    let xfo = "SAMEORIGIN";

    let fileExt = req.params.imgname.split('.').pop();

    if(fileExt == 'jpg' || fileExt == 'jpeg')
    {
        contentType = 'image/jpeg';
    }
    else if(fileExt == 'png')
    {
        contentType = 'image/png';
    }
    else if(fileExt == 'pdf')
    {
        contentType = 'application/pdf';
    }
    else if(fileExt == 'doc')
    {
        contentType = 'application/msword';
    }
    else if(fileExt == 'docx')
    {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    else if(fileExt == 'odt')
    {
        contentType = 'application/vnd.oasis.opendocument.text';
    }
    else if(fileExt == 'xls')
    {
        contentType = 'application/vnd.ms-excel';
    }
    else if(fileExt == 'xlsx')
    {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    else if(fileExt == 'ods')
    {
        contentType = 'application/vnd.oasis.opendocument.spreadsheet';
    }
    else if(fileExt == 'ppt')
    {
        contentType = 'application/vnd.ms-powerpoint';
    }
    else if(fileExt == 'pptx')
    {
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    else if(fileExt == 'odp')
    {
        contentType = 'application/vnd.oasis.opendocument.presentation';
    }
    else
    {
        contentType = 'application/octet-stream';
    }

    let options = {
        root: rootdir,
        headers: {
            'Content-Type': contentType,
            'X-Frame-Options': xfo
        }
    };

    res.sendFile(path.join('./uploads/', req.params.username, req.params.index, req.params.imgname), options);
})

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000 ...');
});