# 🚀 Agentless Software Metering & Automated License Reclamation Engine

An enterprise-grade, serverless architecture built on Microsoft Azure and Intune to detect unused software licenses and automatically revoke them via Entra ID (Azure AD)—saving thousands of dollars a month without deploying third-party agents.

## 💡 The Problem
Enterprise software licenses (Visio, Project, Adobe) are expensive. Industry averages show that 10-15% of installed software goes entirely unused. Traditional solutions (like Nexthink or Flexera) cost upwards of $150,000+ annually and require deploying heavy, resource-draining persistent agents to every single laptop. Furthermore, Microsoft Intune natively lacks historical software metering and automated license revocation.

## 🎯 The Solution
I built a 100% agentless automation engine using native Microsoft 365 and Azure tools. It silently gathers telemetry, visualizes the financial waste on a web dashboard, and securely executes Entra ID group revocations with a single click. 

**Total Infrastructure Cost:** `< $1.00 / month`

## 🏗️ Architecture & Tech Stack

![Architecture Diagram](Assets/architecture-diagram.png) *(Upload your Mermaid image to the Assets folder)*

* **Endpoint:** Windows 11, PowerShell, Intune Proactive Remediations
* **Data Ingestion:** Azure Log Analytics, HTTP Data Collector API, HMAC-SHA256 Cryptography
* **Backend:** Azure Functions (Node.js 20, Serverless Consumption Plan)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript, Azure Static Web Apps ($web storage)
* **Identity & Security:** Microsoft Entra ID, Microsoft Graph API, System-Assigned Managed Identities (Zero-Trust Architecture)

---

## ⚙️ How It Works (The 3-Step Flow)

### 1. Passive Ingestion (Zero Agents)
A lightweight Intune Remediation script (`Detect-UnusedSoftware.ps1`) runs silently on endpoints. It queries process execution history, packages the data into JSON, generates a cryptographic HMAC-SHA256 signature, and POSTs it directly to an Azure Log Analytics workspace. No VPN required.

### 2. Secure Visualization
A static HTML dashboard (`index.html`) fetches the data using an Azure Function GET request. The dashboard calculates the `DaysUnused` metric. If an application has not been opened in >90 days, it is flagged, and a "Revoke" button appears.

### 3. Active Enforcement (Zero Trust Security)
Clicking the "Revoke" button sends a POST request to a dedicated Node.js Azure Function (`RevokeLicenseAPI.js`). Using a System-Assigned Managed Identity—**with no hardcoded credentials or client secrets**—the Function authenticates to the Microsoft Graph API and executes a `DELETE` command, instantly removing the user from the targeted Entra ID licensing group.

---

## 🛠️ Deployment Guide

### Prerequisites
* Microsoft Intune Administrator access.
* Azure Contributor access (scoped to a single Resource Group).
* Entra ID Global Admin (Required *only* once to run the Graph API permission script).

### Step 1: Data Tier
1. Create an Azure Log Analytics Workspace.
2. Retrieve the `Workspace ID` and `Primary Key`.
3. Update `Detect-UnusedSoftware.ps1` with these variables and deploy via Intune Proactive Remediations (Run as SYSTEM).

### Step 2: The Enforcement Engine (Backend)
1. Create a serverless Azure Function App (Node.js 20).
2. Enable a **System-Assigned Managed Identity** for the Function App.
3. Deploy `RevokeLicenseAPI.js` to the Function App.
4. Have a Global Admin run `Grant-GraphPermissions.ps1` to grant the Managed Identity the `GroupMember.ReadWrite.All` permission in Microsoft Graph.

### Step 3: The Dashboard (Frontend)
1. Create an Azure Storage Account and enable the **Static Website** feature.
2. Update `index.html` with your specific Azure Function URLs.
3. Upload `index.html` to the `$web` container.
4. Add the Storage Account's Primary Endpoint URL to the Azure Function's CORS allowed origins list.

---

## 🔒 Security Considerations
* **No Hardcoded Secrets:** The architecture strictly relies on Azure Managed Identities for all Entra ID modifications.
* **Least Privilege:** The backend API is restricted via Azure RBAC and only has permission to read Log Analytics and modify specific Entra ID groups.
* **Payload Verification:** All endpoint telemetry is cryptographically signed using the Log Analytics workspace key to prevent spoofing.

## 🤝 Contributing
Feel free to fork this repository, submit pull requests, or open an issue if you have suggestions for expanding the software tracking parameters!
