const express = require("express");
const fs = require("fs-extra");
const cors = require("cors");

const app = express();
app.use(express.json());
//app.use(cors());
app.use(cors({
  origin: "*", // OK for small internal tool
}));









// Path to shared JSON
//const sharedFile = "\\\\w11ft327pc\\PriyankiShr\\FromSubhajit\\deploymentUpdates\\deployments.json";
const path = require("path");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "deployments.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeJsonSync(DATA_FILE, { deployments: [] }, { spaces: 2 });
}

const sharedFile = path.join(DATA_DIR, "deployments.json");



// Utils
function readData() {
  return fs.readJsonSync(sharedFile);
}
function writeData(data) {
  fs.writeJsonSync(sharedFile, data, { spaces: 2 });
}

/* =========================================================
   CREATE / EDIT DEPLOYMENT
   ========================================================= */
app.post("/api/create-master", (req, res) => {
  const { bank, date, editId } = req.body;

  if (!bank || !date)
    return res.status(400).json({ error: "Bank and date are required" });

  const data = readData();

  if (editId) {
    // Editing existing record
    const deployment = data.deployments.find((d) => d.id === editId);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });

    deployment.bank = bank;
    deployment.date = date;

    writeData(data);
    return res.json({
      success: true,
      message: "Deployment updated",
      deploymentId: deployment.id,
    });
  }

  // Creating new deployment
  const id = `${bank}-${date}`;
  const newDeployment = {
    id,
    bank,
    date,
    messageId: null,           // IMPORTANT — no empty string
    mailThreadStarted: false,  // Thread hasn't started yet
    steps: [
      { name: "Datascript", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Service Layer EA1", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Service Layer EA2", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Report Studio Build", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Advisor Dashboard Build", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Report Studio Deployment", status: "Pending", message: "", updatedBy: "", disabled: false },
      { name: "Advisor Dashboard Deployment", status: "Pending", message: "", updatedBy: "", disabled: false },
    ],
  };

  data.deployments.push(newDeployment);
  writeData(data);

  res.json({
    success: true,
    message: "Deployment created",
    deploymentId: id,   // FRONTEND MUST USE THIS ALWAYS
  });
});

/* =========================================================
   GET DEPLOYMENT BY BANK + DATE (frontend uses this)
   ========================================================= */
app.get("/api/get-deployment", (req, res) => {
  const { bank, date } = req.query;
  if (!bank || !date) return res.status(400).json({ error: "Bank and date required" });

  const data = readData();
  const deployment = data.deployments.find(
    (d) => d.bank === bank && d.date === date
  );

  res.json(deployment || null);
});

/* =========================================================
   GET TODAY'S DEPLOYMENTS
   ========================================================= */
app.get("/api/deployments", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const data = readData();
  res.json(data.deployments.filter((d) => d.date === today));
});

/* =========================================================
   GET OTHER DEPLOYMENTS
   ========================================================= */
app.get("/api/all-deployments", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const data = readData();
  res.json(data.deployments.filter((d) => d.date !== today));
});

/* =========================================================
   UPDATE STEP (return messageId + deploymentId)
   ========================================================= */
app.post("/api/update-step", (req, res) => {
  const { bank, stepName, status, message, updatedBy } = req.body;

  if (!bank || !stepName)
    return res.status(400).json({ error: "Bank and stepName required" });

  const data = readData();
  const today = new Date().toISOString().split("T")[0];

  // find today's deployment
  const deployment = data.deployments.find(
    (d) => d.bank === bank && d.date === today
  );
  if (!deployment) return res.status(404).json({ error: "Deployment not found" });

  const step = deployment.steps.find((s) => s.name === stepName);
  if (!step) return res.status(404).json({ error: "Step not found" });

  // ---- UPDATE THE STEP ----
  if (status) step.status = status;
  if (message) step.message = message;
  if (updatedBy) step.updatedBy = updatedBy;

  // ---- RULE 1: Disable THIS updated step ----
  if(step.status!=="Pending")
  step.disabled = true;

  // ---- RULE 2: If ALL steps are Completed / Not Required → disable all steps ----
  const allDone = deployment.steps.every((s) =>
    ["Completed", "Not Required"].includes(s.status)
  );

  if (allDone) {
    deployment.steps = deployment.steps.map((s) => ({
      ...s,
      disabled: true,
    }));
  }

  writeData(data);

  res.json({
    success: true,
    message: "Step updated successfully",
    lockedStep: stepName,
    allStepsLocked: allDone,
  });
});


/* =========================================================
   SAVE THREAD MESSAGE-ID (VERY IMPORTANT)
   ========================================================= */
app.post("/api/save-message-id", (req, res) => {
  const { deploymentId, messageId, mailThreadStarted } = req.body;

  if (!deploymentId || !messageId)
    return res.status(400).json({ error: "deploymentId and messageId required" });

  const data = readData();
  const deployment = data.deployments.find((d) => d.id === deploymentId);

  if (!deployment) return res.status(404).json({ error: "Deployment not found" });

  // DO NOT OVERWRITE GOOD MESSAGE IDs
  if (!deployment.messageId) {
    deployment.messageId = messageId;
  }

  deployment.mailThreadStarted = !!mailThreadStarted;

  writeData(data);
  res.json({ success: true });
});

/* =========================================================
   START SERVER
   ========================================================= */
//const PORT = 4001;
const PORT = process.env.PORT || 4001;

app.listen(PORT, () =>
  console.log(`✅ Backend running at http://localhost:${PORT}`)
);
