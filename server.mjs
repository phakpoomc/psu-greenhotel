import express from 'express';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { JsonDB, Config } from 'node-json-db';
import sessions from 'express-session';
import crypto from 'crypto';

var db = new JsonDB(new Config("psu-db", true, false, '/'));

var data = await db.getData('/');

var currentID = data.currentID || 0;

var rootdir = process.cwd();

var jsonForm = "";

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

const app = express();
app.use(sessions({
    secret: 'PSUgr33nh0tel53cr3tkEy',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000*60*60*24*7, secure: false, httpOnly: true }
}));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    let coaching = fs.readdirSync('./img/coaching');
    let workshop = fs.readdirSync('./img/workshop');
    let fieldtrip = fs.readdirSync('./img/fieldtrip');
    let openning = fs.readdirSync('./img/openning');
    let certificate = fs.readdirSync('./img/certificate');
    let training = fs.readdirSync('./img/training');

    res.render('./pages/index.ejs', {
        coaching: coaching,
        workshop: workshop,
        fieldtrip: fieldtrip,
        openning: openning,
        certificate: certificate,
        training: training
    });
});

app.get('/loginform', (req, res) => {
    console.log(req.session.userid);
    if(req.session.userid == null)
    {
        res.render('./pages/login');
    }
    else
    {
        req.session.destroy();
        res.redirect("/");
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

        console.log(users);

        if(users.hasOwnProperty(ID) && password == users[ID].info.password)
        {
            req.session.userid = users[ID].info.username;
            req.session.privilege = users[ID].info.privilege;
            req.session.save();
            
            res.redirect('/userform');
        }
        else
        {
            res.send("Invalid username or password");
        }

        console.log(ID, password);
    });
});

app.get('/createAccount', async (req, res) => {
    let session = req.session;

    if(session.userid != null && session.privilege == "admin")
    {
        let users = await db.getData('/users');
        let forms = {};
        let sidebarList = {};

        for(let user of Object.getOwnPropertyNames(users))
        {
            if(users[user]['form'] != null)
            {
                sidebarList[users[user].info.username] = true;
            }

            forms[users[user].info.username] = users[user].info;
        }

        res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, userList: forms, showUser: -1});
    }
    else
    {
        res.redirect('/');
    }
});

app.get('/removeAccount/:username', async (req, res) => {
    data = await db.getData('/');
    currentID = data.currentID + 1;

    if(req.session.userid != null && req.session.privilege == "admin")
    {
        await db.delete('/users/' + req.params.username);

        res.redirect('/createAccount');
    }
    else
    {
        res.redirect("/");
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

            await db.push('/users/' + username + '/info', {"username": username, "password": password, "id": ++currentID, "privilege": "user"}, false);
            await db.push('/currentID', currentID);

            console.log(username, password);

            res.redirect('/createAccount');
        });
    }
    else
    {
        res.redirect("/");
    }
});

app.get('/userform', async (req, res) => {
    let session = req.session;

    if(session.userid != null)
    {
        if(session.privilege == "admin")
        {
            res.redirect('/adminform');
        }
        else
        {
            res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, result: null});
        }
    }
    else
    {
        res.redirect('/loginform');
    }    
});

app.get('/userresult', async (req, res) => {
    let session = req.session;

    if(session.userid != null)
    {
        if(session.privilege == "admin")
        {
            res.redirect('/adminform');
        }
        else
        {
            let data = await db.getData('/users/' + session.userid);

            if(data['result'] != null)
            {
                res.render('./pages/userform.ejs', {username: session.userid, data: jsonForm, forms: data['form'], result: data['result']});
            }
            else
            {
                res.send('????????????????????????????????????????????????????????????????????????????????? Admin');
            }
            
        }
    }
    else
    {
        res.redirect('/loginform');
    }  
});

app.get('/adminform', async (req, res) => {
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

        res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, data: jsonForm, showUser: null});
    }
    else
    {
        res.redirect('/');
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
                res.render('./pages/adminform.ejs', {username: session.userid, sidebarList: sidebarList, forms: users[req.params.userid]['form'], data: jsonForm, showUser: req.params.userid});
            }
            else
            {
                res.redirect('/adminform');
            }
        }
        else
        {
            res.redirect('/adminform');
        }
        
    }
    else
    {
        res.redirect('/');
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

        res.json(data);
    });
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

    res.json(data);
  });
});

app.get('/css/:cssname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'text/css; charset=UTF-8'
        }
    };

    res.sendFile('/src/css/' + req.params.cssname, options);
})

app.get('/js/:jsname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'text/javascript; charset=UTF-8'
        }
    };

    res.sendFile('/src/js/' + req.params.jsname, options);
})

app.get('/img/:imgname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'image/png'
        }
    };

    res.sendFile('/img/' + req.params.imgname, options);
})

app.get('/img/:subfolder/:imgname', (req, res) => {
    let options = {
        root: rootdir,
        headers: {
            'Content-Type': 'image/jpeg'
        }
    };

    res.sendFile('/img/' + req.params.subfolder + '/' + req.params.imgname, options);
})

app.get('/uploads/:username/:index/:imgname', (req, res) => {
    var contentType = "";

    if(req.params.imgname.split('.').pop() == 'jpg' || req.params.imgname.split('.').pop() == 'jpeg')
    {
        contentType = 'image/jpeg';
    }
    else if(req.params.imgname.split('.').pop() == 'png')
    {
        contentType = 'image/png';
    }
    else
    {
        // NEED FIX
        contentType = 'image/png';
    }

    let options = {
        root: rootdir,
        headers: {
            'Content-Type': contentType
        }
    };

    res.sendFile(path.join('/uploads/', req.params.username, req.params.index, req.params.imgname), options);
})

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000 ...');
});