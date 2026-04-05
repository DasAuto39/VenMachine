# VenMachine - Smart Automated Vending Machine System

## What is This Project?

So basically, we're building an automated vending machine that can serve three customers at the same time. Think of it like a typical vending machine you'd find in a mall, but way smarter. Instead of just pressing buttons, customers scan a QR code at their gate, and boom - they get redirected to a web interface where they can browse products and pay. Once they complete the payment, the system automatically tells the machine to dispense their items from the designated gate.

## How It Works

Here's the flow:

1. **Customer Scans QR Code** - A customer walks up to one of the three gates and scans the unique QR code linked to that gate
2. **Web Interface Opens** - They get directed to the shopping page with their specific gate ID registered in the session
3. **Browse & Select Products** - They can filter by category, search for items, and add whatever they want to the cart
4. **Payment & Checkout** - The system handles payment processing (we're planning QRIS integration later)
5. **Machine Dispenses** - Once payment is confirmed, the system sends a signal to the controller (Raspberry Pi/MPU) to activate the motor and dispense the items from that specific gate
6. **Next Customer** - While one customer is getting their items, another person can be shopping at a different gate

The cool part is that all three gates work independently, so three people can shop and receive their orders at the same time without waiting.

## Tech Stack

- **Frontend**: React with Tailwind CSS - responsive web interface for shopping and checkout
- **Backend**: FastAPI - handles all the business logic, payment processing, and communication with the vending machine
- **Database**: PostgreSQL - stores product inventory, transaction logs, and machine location data
- **Hardware Integration**: Controllers (Raspberry Pi/MPU) - receives commands to control the motors and dispense products
- **Containerization**: Docker Compose - makes deployment clean and consistent

## Project Structure

```
VenMachine/
├── backend/          # FastAPI server with parameterized queries for security
├── frontend/         # React app for the shopping interface
├── docker-compose.yml # Container orchestration
└── database schema   # PostgreSQL tables for items, locations, and logs
```

## Features

- Real-time inventory management
- Secure payment handling (integrating QRIS soon)
- Gate-based product delivery system
- Mobile-optimized shopping interface
- Category filtering and product search
- Transaction logging for analytics
- Professional dashboard for admin management

## Current Status

We've got the core shopping system working, secure database operations in place, and the UI looking clean. Next up is integrating real payment processing with QRIS and testing the actual hardware communication with the controller.

## Team Project

This is a capstone project we're working on as a team, so it's a full-stack implementation from hardware integration to web development. The goal is to have a fully functional, production-ready vending machine system by the end of the semester. 
