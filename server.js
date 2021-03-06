const express = require('express')
const request = require('request')
const mongodb = require('mongodb')
const exphbs = require('express-handlebars')
const sanitizeHTML = require('sanitize-html')
var fs = require('fs');
const path = './token.json';

const app = express();

const oauthDetails = {
    client_id: 'oauth2client_0000A2fX0LHstmlC7ItnDF',
    client_secret: 'mnzpub.Elqcd/NpqJFx+cBGGbMoAzRc2KIV/rTcYd1FVLg4fKK34prBF3DJQBUfg8tWoNMQf+pUWvhQbLESYo2swsvILQ==',
    redirect_uri: 'http://localhost:5000/oauth/callback'
  };

let accessToken = null;
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({extended: false}))

let db;


const PORT = process.env.PORT || 4000;

// Connect to database before the website works
let connectionstring_grocery = 'mongodb+srv://aus123:aus123@cluster0.hflbh.mongodb.net/grocery?retryWrites=true&w=majority'

// let client = new mongodb(connectionstring)

mongodb.connect(connectionstring_grocery, { useUnifiedTopology: true.valueOf},(err, client) => {
    db = client.db();
    // See what are the collections inside the database
    db.listCollections().toArray(function (err, collectionInfos) {
      console.log(collectionInfos)
    })
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
})



// Set Handlebars
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');


function passwordProtected(req, res, next){
  res.set('WWW-Authenticate', 'Basic realm="Simple App"')
  console.log(req.headers.authorization)
  if (req.headers.authorization == "Basic YXVzdGluZmVvbnNpbW9uOg=="){
    next()
  }else{
    res.status(401).send("Authentication required")
  }

}

app.use(passwordProtected)

// Set Handlebars route
app.get('/', function (req, res) {
    res.render('home')
});

// For shopping list
app.get('/shopping_list', function(req, res){
    db.collection('items').find({checked: false}).toArray((err, items) =>{
        items = JSON.stringify(items)
        console.log(items)
        console.log('in2')

        let checked_item_;
        let temp = db.collection('checked_item').find({}).sort({ $natural: -1 }).limit(5).toArray((err, checked_item) =>{
          console.log("in1")
          checked_item_ = JSON.stringify(checked_item)
          console.log("testing: " + checked_item_ )
          res.render('shopping_list', {stuff: items, checked_stuff: checked_item_})
        })

    
})
})

app.post('/create-item', (req, res) =>{
    let safeText =sanitizeHTML(req.body.name, {allowedTags: [], allowedAttributes: {}})
    let item = safeText.split("#")[0]
    let person = safeText.slice(-1)
    console.log(person)
    db.collection('items').insertOne({name: item, checked: false, person: person}, function(err, info){
        // res.redirect('/shopping_list');
    res.json(info.ops[0])
    } )  
})

app.post('/update-item', (req, res) =>{
  let safeText =sanitizeHTML(req.body.name, {allowedTags: [], allowedAttributes: {}})
    db.collection('items').findOneAndUpdate({_id: new mongodb.ObjectId(req.body.id)},{$set: {name: safeText}}, () =>{
        res.send("Success")
    })
})

app.post('/delete-item', (req, res)=>{
    db.collection('items').findOneAndUpdate({_id: new mongodb.ObjectId(req.body.id)}, {$set: {checked: true}},function(){
        res.send("Success")
    })
})

app.post('/check-item', (req, res) =>{
  db.collection('items').findOneAndUpdate({_id: new mongodb.ObjectId(req.body.id)},{$set: {checked: true}}, () =>{
    db.collection('checked_item').insertOne({name: req.body.name}), () =>{
    }
    res.send("Success")
  })
})

app.get('/shopping_list/a', function (req, res) {
  res.send('aaa')
})

// Create split_bill route
app.get('/split_bills', (req, res) => {
    const { client_id, redirect_uri } = oauthDetails;
    const monzoAuthUrl = 'https://auth.monzo.com';
    try{
    accessToken = JSON.parse(fs.readFileSync(path,{encoding:'utf8'}));
    }
    catch (err){
      res.redirect(monzoAuthUrl + "?client_id=" + client_id + "&redirect_uri=" + redirect_uri + "&response_type=code");
    }
    const {token_type, access_token} = accessToken;
    const ping = 'https://api.monzo.com/ping/whoami';
    // change to more efficient way
    request.get(ping,{
        headers: {
            Authorization: `${token_type} ${access_token}`
        }
    }, (req, response, body) => {
        const {authenticated} = JSON.parse(body);
        console.log(authenticated);
        if(!authenticated){
            res.redirect(monzoAuthUrl + "?client_id=" + client_id + "&redirect_uri=" + redirect_uri + "&response_type=code");
        }
        else{
            res.type('html');
            res.redirect('/accounts');
        }
        
    })
});


app.get('/oauth/callback', (req, res) => {
    const { client_id, client_secret, redirect_uri } = oauthDetails;
    const { code } = req.query;
    const monzoAuthUrl = `https://api.monzo.com/oauth2/token`;

    // Initiate request to retrieve access token
    request.post({
      url: monzoAuthUrl,
      form: {
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        redirect_uri,
        code
      } 
    }, (err, response, body) => {
      if(err){
          throw err;
      }
      accessToken = JSON.parse(body); // Populate accessToken variable with token response
      console.log(accessToken);
      fs.writeFile(path,JSON.stringify(accessToken),'utf8',(err) =>{
        if(err){
          console.log(err);
        }
      });
      res.type('html');
      res.redirect('/accounts'); // Send user to their accounts
    });
  });

  app.get('/accounts', (req, res) => {
    // alert('Please accept');
    const { token_type, access_token } = accessToken;
    const accountsUrl = 'https://api.monzo.com/accounts';
    
    request.get(accountsUrl, {
      headers: {
        Authorization: `${token_type} ${access_token}`
      }
    }, (req, response, body) => {
      const { accounts } = JSON.parse(body);
  
      res.type('html');
      res.write('<h1>Accounts</h1><ul>');

      res.write(`<li>account = ${accounts}</li>`);
      

      for (let account of accounts){
       const {id, type, description } = account;
        res.write(`
          <li>
            ${description}(<i>${type}</i>) - <a href="/transactions/${id}">View transaction history</a>
          </li>
        `);
        
      
      }
      res.end('</ul>');
    });
});

app.get('/transactions/:acc_id', (req, res) => {
    const { acc_id } = req.params;
    const { token_type, access_token } = accessToken;
    const transactionsUrl = `https://api.monzo.com/transactions?expand[]=merchant&account_id=${acc_id}&limit=30`;
    
    request.get(transactionsUrl, {
      headers: {
        Authorization: `${token_type} ${access_token}` 
      }
    }, (req, response, body) => {
      const { transactions } = JSON.parse(body);
  
      res.type('html');
      res.write(`
        <h1>Transactions</h1>
        <table>
          <thead>
            <th>Description</th>
            <th>Amount</th>
            <th>Category</th>
          </thead>
          <tbody>
      `);
      
      for(let transaction of transactions) {
        const {
          description,
          amount,
          category
        } = transaction;
        
        res.write(`
          <tr>
            <td>${description}</td>
            <td>${(amount/100).toFixed(2)}</td>
            <td>${category}</td>
          </tr>
        `);
      }
      
      res.write('</tbody></table>');
      res.end('<br /><a href="/accounts">&lt; Back to accounts</a>');
    });
  });