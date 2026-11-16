#UNDER DEVELOPMENT

# HuaCBT

HuaCBT is a computer-based testing (CBT) web application that provides a streamlined and efficient platform for online examinations. It is designed to meet the needs of educational institutions, training centers, and organizations that require a reliable system for administering tests.

## Features

- **Secure REST API**: Powered by ElysiaJS (Bun) on PostgreSQL, ensuring robust backend operations and secure data handling.
- **Responsive Frontend**: Built with Vue.js, providing a dynamic and user-friendly interface for both administrators and test-takers.
- **Role-Based Access Control**: Supports multiple user roles such as admins, teachers, and students, each with tailored access levels.
- **Excel for Import/Export Users, Tests**: you can import user(test taker, teacher, admin), and even for the test(you can import the test and export the grade).

## Tech Stack

- **ElysiaJS** (on Bun) + **Drizzle ORM**: Backend framework for building the REST API.
- **Vue.js + TypeScript + shadcn-vue**: Frontend framework for creating a responsive and dynamic user interface.
- **PostgreSQL**: Database (Drizzle ORM).
- **TekSso**: Single sign-on (OAuth2) for login.
- **Tailwind CSS**: CSS Framework for creating a beautiful webapps design.

## Installation

Requires [Bun](https://bun.sh), PostgreSQL and a running [TekSso](../teksso) instance with this app registered (redirect URI `http://localhost:4000/auth/callback`).

```bash
bun install
cp apps/api/.env.example apps/api/.env   # DATABASE_URL, SESSION_SECRET, TEKSSO_*, BOOTSTRAP_ADMIN
cd apps/api && bunx drizzle-kit push && cd ../..
bun run api    # http://localhost:4000
bun run web    # http://localhost:5173
```

See `CLAUDE.md` for architecture, the feature plan and project rules.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
