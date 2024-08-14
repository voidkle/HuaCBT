#UNDER DEVELOPMENT

# HuaCBT

HuaCBT is a computer-based testing (CBT) web application that provides a streamlined and efficient platform for online examinations. It is designed to meet the needs of educational institutions, training centers, and organizations that require a reliable system for administering tests.

## Features

- **Secure REST API**: Powered by Laravel, ensuring robust backend operations and secure data handling.
- **Responsive Frontend**: Built with Vue.js, providing a dynamic and user-friendly interface for both administrators and test-takers.
- **Role-Based Access Control**: Supports multiple user roles such as admins, teachers, and students, each with tailored access levels.
- **Excel for Import/Export Users, Tests**: you can import user(test taker, teacher, admin), and even for the test(you can import the test and export the grade).

## Tech Stack

- **Laravel**: Backend framework for building the REST API.
- **Vue.js**: Frontend framework for creating a responsive and dynamic user interface.
- **MySQL**: Database management system for storing user data, tests, and results.
- **JWT Authentication**: Secure token-based authentication for users.
- **Tailwind CSS**: CSS Framework for creating a beautiful webapps design.
- 

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/HuaCBT.git
    cd HuaCBT/Backend
    ```

2. **Install backend dependencies**:
    ```bash
    composer install
    ```

3. **Set up environment variables**:
    ```bash
    cp .env.example .env
    php artisan key:generate
    php artisan jwt:secret
    ```

5. **Configure your database** in the `.env` file and then run migrations:
    ```bash
    php artisan migrate
    ```

6. **Seed the database with default user**:
    ```bash
    php artisan db:seed
    ```

7. **Start the Rest Api server**:
    ```bash
    php artisan serve
    ```
8. **Install frontend dependencies**:
    ```bash
    cd HuaCBT/Frontend
    npm install
    ```
9. **Run the frontend**:
    ```bash
    npm run dev
    ```

## Usage

- Access the rest api via `http://localhost:8000` after starting the development server.
- to access the vue frontend go to `http://localhost:3000` and you should be at Login page
- the default user for admin is `Username : fuhua, Password : admin`, and you should good to go.
- The admin privilege is for adding Users, ban Test-taker, literally everything.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
