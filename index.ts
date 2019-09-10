import * as dotenv from "dotenv";
import * as crypto from "crypto";
import * as express from "express";
import bufferEq from "buffer-equal-constant-time";
import * as bodyParser from "body-parser";
import { exec } from "child_process";

dotenv.config();

const secret = process.env.SECRET;
const repo = process.env.REPO;
const ghUrl = `https://${process.env.GH_USERNAME}:${process.env.GH_TOKEN}@github.com/${repo}.git --all `;
const port = process.env.PORT;
const signatureHeader = "x-hub-signature";

function signData(secret: string, data: string) {
  return (
    "sha1=" +
    crypto
      .createHmac("sha1", secret)
      .update(data)
      .digest("hex")
  );
}

function verifySignature(secret: string, data: string, signature: string) {
  return bufferEq(new Buffer(signature), new Buffer(signData(secret, data)));
}

const app = express();
app.use(bodyParser.json());

app.post("/github/push", function(req, res) {
  if (
    secret &&
    !verifySignature(secret, JSON.stringify(req.body), (req.headers[
      signatureHeader
    ] || "") as string)
  ) {
    console.error("Failed to verify signature");
    process.exit(1);
  }

  res.json(req.body);
});

app.listen(port);
