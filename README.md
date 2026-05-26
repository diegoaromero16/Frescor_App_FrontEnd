# Frescor App

Angular frontend for **Frescor**, an ice delivery management platform. Handles order creation, customer management, delivery zones, discount coupons, debt tracking, and online payments via Mercado Pago.

The backend is a separate ASP.NET Core Web API connected to an Azure SQL database.

---

## Features

- **Orders** — place and manage delivery orders with real-time status tracking
- **Customers** — manage customer profiles and delivery addresses
- **Products** — configure product catalog and pricing
- **Delivery zones** — define and assign geographic delivery areas
- **Coupons** — create and apply discount codes
- **Debt management** *(admin)* — track unpaid orders, generate receipts, mark as paid or delete
- **Generate receipt** *(delivery staff)* — look up a customer's recent orders and generate a shareable receipt via WhatsApp
- **Payments** — Mercado Pago integration with payment result handling
- **Role-based access** — separate views and routes for admins and delivery staff

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 (standalone components) |
| UI | Angular Material + Tailwind CSS 4 |
| PDF / Images | jsPDF + Canvas API |
| SSR | Angular SSR (Express) |
| Payments | Mercado Pago |
| Backend | ASP.NET Core Web API *(separate repo)* |
| Database | Azure SQL *(database-first)* |
| Hosting | Azure App Service |

---

## Prerequisites

- Node.js 20+
- npm 8+
- Angular CLI 21

```bash
npm install -g @angular/cli
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/diegoaromero16/Frescor-App.git
cd Frescor-App
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Edit `src/environments/environment.ts` and set your API URL:

```ts
export const environment = {
  production: false,
  apiUrl: 'https://your-api-url/api'
};
```

### 4. Run the development server

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

---

## Build

```bash
npm run build
```

Output is placed in `dist/Frescor-App/`.

---

## Project Structure

```
src/app/
├── core/
│   ├── model/          # TypeScript interfaces
│   ├── services/       # HTTP services (orders, customers, boletas, etc.)
│   └── guards/         # authGuard, adminGuard
├── layout/
│   └── admin-layout/   # Shared shell layout with sidebar
└── pages/
    ├── auth/login/
    ├── dashboard/
    ├── pedido/
    ├── clientes/
    ├── productos/
    ├── zonas/
    ├── cupones/
    ├── deudas/
    ├── generar-boleta/
    └── payment-result/
```

---

## Backend

The API repository is available at [Frescor_Api_v1](https://github.com/ReydelHielo123/Frescor_Api_v1).
