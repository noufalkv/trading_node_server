import dotenv from "dotenv";
import connectDB from "../config/connect.js";
import User from "../models/User.js";
import mongoose from "mongoose";

dotenv.config();

const seedUsers = async () => {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    await connectDB(process.env.MONGO_URI);
    console.log("✅ Connected to database successfully!");

    // Test users data
    const testUsers = [
      {
        email: "noufalkv@gmail.com",
        password: "SecurePass123!",
        name: "Noufal KV",
        balance: 50000.0
      },
      {
        email: "testuser@gmail.com", 
        password: "TestPass123!",
        name: "Test User",
        balance: 25000.0
      },
      {
        email: "demo@example.com",
        password: "DemoPass123!",
        name: "Demo User", 
        balance: 75000.0
      }
    ];

    console.log(`👥 Creating ${testUsers.length} test users...`);

    // Create users one by one (to trigger password hashing)
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Create new user
        const user = await User.create(userData);
        console.log(`✅ Created user: ${user.email} (ID: ${user._id})`);
      } catch (error) {
        console.error(`❌ Error creating user ${userData.email}:`, error.message);
      }
    }

    console.log("\n🎉 User seeding completed!");

  } catch (error) {
    console.error("❌ Error seeding users:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
};

// Run the seed function
seedUsers();