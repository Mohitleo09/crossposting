# Crossposting

**One Post. All Platforms.**

Crossposting is a powerful social media automation tool that allows you to connect your accounts once and upload everywhere. Enhance your social media presence by automatically sharing your Instagram content to Twitter and YouTube without the manual hassle.

## 🚀 Features

- **Multi-Platform Sync**: Automatically repost content from **Instagram** to **Twitter (X)** and **YouTube**.
- **Smart Media Handling**:
  - **Images/Carousels**: Automatically posted to Twitter.
  - **Reels/Videos**: Automatically posted to Twitter and YouTube (as Shorts/Videos).
- **Granular Control**: Enable or disable auto-posting for specific platforms at any time.
- **Secure Authentication**: Uses official OAuth 2.0 flows for all platforms. Your passwords are never stored. credentials are encrypted at rest.
- **Mobile-Responsive Design**: Manage your accounts and status from any device.
- **Real-time Status**: Track the success of your crossposts via a dedicated dashboard.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose)
- **Styling**: Standard CSS & Inline Styles for maximum control and performance.
- **Authentication**: Custom JWT & OAuth 2.0 (Instagram Basic Display, YouTube Data API, Twitter API v2).
- **Video Processing**: FFmpeg for media handling and conversion.
- **Deployment**: Optimized for Vercel.

## 🏁 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB Atlas Account (or local MongoDB)
- Developer Accounts for:
  - Meta (Instagram)
  - Google (YouTube)
  - Twitter (X)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Mohitleo09/cross.git
    cd crossposting
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and configure it based on `.env.example`:

    ```env
    # Database
    MONGODB_URI=your_mongodb_connection_string

    # Auth & Security
    JWT_SECRET=your_secure_random_string
    ENCRYPTION_KEY=your_encryption_key

    # App URL
    NEXT_PUBLIC_BASE_URL=http://localhost:3000

    # OAuth Credentials (get these from respective developer portals)
    INSTAGRAM_CLIENT_ID=...
    INSTAGRAM_CLIENT_SECRET=...
    INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/oauth/instagram/callback

    YOUTUBE_CLIENT_ID=...
    YOUTUBE_CLIENT_SECRET=...
    YOUTUBE_REDIRECT_URI=http://localhost:3000/api/oauth/youtube/callback

    TWITTER_CLIENT_ID=...
    TWITTER_CLIENT_SECRET=...
    TWITTER_REDIRECT_URI=http://localhost:3000/api/oauth/twitter/callback
    ```

4.  **Run the application**
    ```bash
    npm run dev
    ```

5.  **Open browser**
    Navigate to `http://localhost:3000` to see the app.

## 🌍 Deployment

This project is optimized for deployment on **Vercel**.

1.  Push your code to a GitHub repository.
2.  Import the project into Vercel.
3.  Add all environment variables from your `.env` file to the Vercel project settings.
4.  **Important**: Update `NEXT_PUBLIC_BASE_URL` to your production URL (e.g., `https://your-app.vercel.app`).
5.  Update the Redirect URIs in your Meta, Google, and Twitter developer apps to match the production URL.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for a detailed step-by-step guide.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
