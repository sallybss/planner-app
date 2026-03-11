import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;

export async function testConnection() {
  try {
    await connect();
    console.log("Database connection test completed");
  }
  catch (error) {
    console.log("Error testing database connection. Error: " + error);
    throw error;
  }
}

export async function connect() {
  try {
    if (!process.env.DBHOST) {
      throw new Error("DBHOST environment variable is not defined");
    }

    if (mongoose.connection.readyState === 1) return;
    if (mongoose.connection.readyState === 2 && connectPromise) {
      await connectPromise;
      return;
    }

    connectPromise = mongoose.connect(process.env.DBHOST);
    await connectPromise;

    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
    } else {
      throw new Error("Database connection is not established");
    }
  } catch (error) {
    console.log("Error connecting to the database. Error: " + error);
    throw error;
  } finally {
    connectPromise = null;
  }
}

export async function disconnect(force = false) {
  if (!force) return;

  try {
    await mongoose.disconnect();
    console.log("Connection closed");
  } catch (error) {
    console.log("Error closing database connection. Error: " + error);
    throw error;
  }
}
