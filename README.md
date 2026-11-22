# Raja Rani — E-Learning Platform

A full-stack e-learning platform designed to bring online courses, learning resources, payments, live classes and student management together in one ecosystem.

Built with **Flutter, Next.js, NestJS and PostgreSQL**, Raja Rani combines a mobile learning experience, an administrative dashboard and a scalable backend.

<p align="center">
  **Flutter · Next.js · NestJS · PostgreSQL · Prisma**
</p>

---

## Overview

Raja Rani is a multi-platform learning management system (LMS) structured around three major components:

- **Mobile Application:** A Flutter app for students to access courses and learning features.
- **Admin Dashboard:** A Next.js web application for managing platform operations.
- **Backend API:** A NestJS service responsible for authentication, business logic, data management and integrations.

The project follows a modular architecture to keep the applications maintainable and easier to extend.

## Key Features

### Student Mobile Application
- User registration and authentication
- OTP-based login flow
- Course discovery and course details
- Learning library and lesson access
- Video lesson experience
- Course checkout and payment integration
- Order history
- Certificates
- Live classes
- Notifications
- Community and support features
- Search and reporting

### Admin Dashboard
- Admin authentication
- Dashboard and account management
- User management
- Course management
- Live class management
- Order and payment management
- Coupon management
- Certificate management
- Banner management
- Community management
- Notifications
- Reports and audit logs
- Platform settings and support

### Backend & Integrations
- REST API using NestJS
- PostgreSQL database
- Prisma ORM
- Authentication and authorization
- Role-based access control
- Razorpay payment integration
- Cloudflare Stream video integration
- Push notification provider integration
- Live-class provider architecture
- Scheduled background tasks
- API testing and end-to-end testing

## Technology Stack

| Layer | Technologies |
|---|---|
| Mobile | Flutter, Dart |
| Admin Frontend | Next.js, React, TypeScript |
| Backend | NestJS, Node.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Payments | Razorpay |
| Video | Cloudflare Stream |
| Styling | Tailwind CSS |
| Testing | Jest |
| Infrastructure | Docker, Docker Compose |
| CI/CD | GitHub Actions |

## Architecture

```text
                 RAJA RANI PLATFORM
                         |
          +--------------+--------------+
          |              |              |
       Mobile         Admin          Backend
       Flutter        Next.js         NestJS
          |              |              |
          +--------------+--------------+
                         |
                      REST API
                         |
                  Business Logic
                         |
                    Prisma ORM
                         |
                    PostgreSQL
                         |
          +--------------+--------------+
          |              |              |
       Razorpay     Cloudflare       Notifications
       Payments       Stream          Providers
```

## Project Structure

```text
raja-rani/
│
├── apps/
│   ├── mobile/              # Flutter student application
│   └── admin/               # Next.js admin dashboard
│
├── services/
│   └── api/                 # NestJS backend API
│       ├── prisma/          # Database schema and migrations
│       ├── src/             # Backend modules and services
│       └── test/            # End-to-end tests
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── PAYMENTS.md
│   ├── SECURITY.md
│   ├── SETUP_GUIDE.md
│   ├── TESTING.md
│   └── VIDEO.md
│
├── infra/
│   └── docker/              # Docker configuration
│
├── .github/
│   └── workflows/           # GitHub Actions workflows
│
├── .gitignore
├── README.md
└── PROJECT_STATUS.md
```

## Getting Started

### Prerequisites

Install the following tools before starting:

- Node.js and npm
- Flutter SDK
- PostgreSQL
- Git
- Docker (optional)

### 1. Clone the Repository

```bash
git clone https://github.com/alokxyadav/raja-rani.git
cd raja-rani
```

### 2. Configure the Backend

```bash
cd services/api
npm ci
cp .env.example .env
```

Configure your environment variables in `services/api/.env`, including your database connection and the credentials required by the integrations you intend to use.

Run database migrations using the project's configured Prisma setup.

```bash
npx prisma generate
npx prisma migrate dev
```

Start the backend using the development script defined in `package.json`.

```bash
npm run start:dev
```

### 3. Configure the Admin Dashboard

Open another terminal:

```bash
cd apps/admin
npm install
cp .env.example .env.local
```

Configure the API URL and other required environment variables.

Start the development server:

```bash
npm run dev
```

### 4. Configure the Flutter Application

Open another terminal:

```bash
cd apps/mobile
flutter pub get
flutter run
```

Configure the API base URL and other required application settings before running the app.

> Refer to the individual setup guides and `.env.example` files for the exact configuration required by each component.

## Documentation

Detailed technical documentation is available in the `docs/` directory.

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System architecture and components |
| [API Documentation](docs/API.md) | Backend API information |
| [Database](docs/DATABASE.md) | Database structure and schema |
| [Setup Guide](docs/SETUP_GUIDE.md) | Development environment setup |
| [Deployment](docs/DEPLOYMENT.md) | Deployment instructions |
| [Payments](docs/PAYMENTS.md) | Payment integration |
| [Notifications](docs/NOTIFICATIONS.md) | Notification architecture |
| [Live Classes](docs/LIVE_CLASSES.md) | Live-class functionality |
| [Video](docs/VIDEO.md) | Video integration |
| [Security](docs/SECURITY.md) | Security considerations |
| [Testing](docs/TESTING.md) | Testing instructions |

## Testing

Backend tests can be run from the API directory:

```bash
cd services/api
npm test
```

For end-to-end tests:

```bash
npm run test:e2e
```

For Flutter tests:

```bash
cd apps/mobile
flutter test
```

Check each package's `package.json` and project documentation for its available scripts and prerequisites.

## Security

Security is an important part of the project.

- Never commit `.env` files or private credentials.
- Use `.env.example` as a configuration template.
- Keep payment gateway secrets on the server.
- Protect private API endpoints with appropriate authentication and authorization.
- Store production credentials securely.
- Review the security documentation before deployment.

## Development Workflow

1. Clone the repository.
2. Configure the backend and database.
3. Start the API service.
4. Start the admin dashboard.
5. Run the Flutter application.
6. Test the relevant features.
7. Submit changes through a pull request.

## Current Project Status

Raja Rani is an actively developed project.

Refer to [PROJECT_STATUS.md](PROJECT_STATUS.md) for the detailed development progress, completed modules and remaining work.

## Contributing

Contributions, suggestions and improvements are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test your changes.
5. Submit a pull request with a clear description.

## License

No open-source license has been specified yet. Please contact the repository owner before redistributing or using this project beyond the permissions granted by applicable law.

## Author

**Alok Yadav**

GitHub: [@alokxyadav](https://github.com/alokxyadav)

---

<p align="center">
  **Raja Rani — Building a Better Learning Experience.**
</p>
