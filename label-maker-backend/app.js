
const express         = require('express'); // Handling Routes
const dymo            = require('dymo');
const csrf            = new (require('csrf'));
const config          = require('./config.js');

const app = express();
const port = 8080;

const getQRImage = function getQRImageData(req,res,next){
  var url = 'http://ec2-54-186-192-209.us-west-2.compute.amazonaws.com:8080/images/'+req.email+'.png';

  var r = request.defaults({encoding:null});
  r.get(url,(err,response,body)=>{
    if(err){
      console.log(err);
    }else if(response.statusCode === 404 && (req.body.qrRetries == null || req.body.qrRetries < 3)){
      console.log('404 ERROR');
      //NOT SURE IF THIS IS COOL-> generate a new QRImage by passing in email to QRU server
      var qrurl = 'http://ec2-54-186-192-209.us-west-2.compute.amazonaws.com:8080/viewqr?email='+req.email;
      request.get(qrurl,(error,resp,bod)=>{
          if(req.body.qrRetries == null){
            req.body.qrRetries = 1;
          }else{
            req.body.qrRetries += 1;
          }
          getQRImageData(req,res,next);
      });
    } else{
      req.body.qrimage = new Buffer(body).toString('base64');
      return next();
    }
  });
}

const setUpAuth = function(secret){
    app.get('/auth', (req, res) => {
        if(req.query.pass != config.password){
            res.send(403, "Invalid request or password");
        }else{
            res.send(200, csrf.create(secret));
        }
    });

    app.get('/print', (req, res) => {
        if(!csrf.verify(secret, req.query.csrf)){
            res.send(403, "Invalid request");
        }else{
            getQRImage(req.email, () => {
                const qr = req.body.qrimage;
                const printerArgs = {
                    printer: config.printerName,
                    label: config.labelFileName,
                    fields: {
                        first_name: req.query.first_name,
                        last_name: req.query.last_name
                    },
                    images: {
                        qr: qr
                    }
                };

                dymo.print(printerArgs, (err, res) => {
                    if(err) {
                        res.send(503, "Printer error: " + err);
                        return;
                    }
                    res.send(200, csrf.create(secret));
                });
            });
        }
    });
}

csrf.secret((err, secret) => {
    if(err){
        console.log(err);
        return;
    }
    setUpAuth(secret);
    app.listen(port);
});