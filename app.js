import "express-async-errors";
import express from "express";
import dotenv from "dotenv";
import { createServer } from "http";
import swaggerUI from "swagger-ui-express";
import YAML from "yamljs";
import notFoundMiddleware from "./middleware/not-found.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";
import cors from "cors";
import connectDB from "./config/connect.js";
import authRouter from "./routes/auth.js";
import stockRouter from "./routes/stocks.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import authenticateSocketUser from "./middleware/socketAuth.js";
import {
  scheduleDayReset,
  update10minCandle,
  generateRandomDataEvery5Second,
} from "./services/cronJob.js";
import { Server } from "socket.io";
import socketHandshake from "./middleware/socketHandshake.js";
import Stock from "./models/Stock.js";
// import { send } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

scheduleDayReset();
generateRandomDataEvery5Second();
update10minCandle();

const holidays = ["2024-05-18", "2024-05-31"];

const isTradingHour = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
  const isWeekday = dayOfWeek > 0 && dayOfWeek < 6; // Monday to Friday
  const isTradingTime =
    (now.getHours() === 9 && now.getMinutes() >= 30) ||
    (now.getHours() > 9 && now.getHours() < 15) ||
    (now.getHours() === 15 && now.getMinutes() <= 30);

  const today = new Date().toISOString().slice(0, 10);

  const isTradingHour = isWeekday && isTradingTime && !holidays.includes(today);

  // return isTradingHour;
  return true;
};

const app = express();
app.use(express.json());

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEBSERVER_URI || "http://localhost:3001",
    methods: ["GET", "POST"],
    allowedHeaders: ["access_token"],
    credentials: true,
  },
});
io.use(socketHandshake);

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("subscribeToStocks", async (stockSymbol) => {
    console.log(`Client ${socket.id} subscribed to stock: ${stockSymbol}`);
    const sendUpdates = async () => {
      try {
        const stock = await Stock.findOne({ symbol: stockSymbol });
        if (!stock) {
          console.error(`Stock with symbol ${stockSymbol} not found.`);
          return;
        } else {
          socket.emit(`${stockSymbol}`, stock);
        }
      } catch (error) {
        console.error("Error sending stock update:", error);
      }
    };

    sendUpdates();

    const intervalId = setInterval(sendUpdates, 5000);

    if (!isTradingHour()) {
      clearInterval(intervalId);
    }
  });

  socket.on("subscribeToMultipleStocks", async (stockSymbols) => {
    console.log(
      `Client ${socket.id} subscribed to multiple stocks: ${stockSymbols}`
    );
    const sendUpdates = async () => {
      try {
        const stocks = await Stock.find({ symbol: { $in: stockSymbols } });
        const stockData = stocks.map((stock) => ({
          symbol: stock.symbol,
          currentPrice: stock.currentPrice,
          lastDayTradedPrice: stock.lastDayTradedPrice,
        }));

        socket.emit("multipleStocksData", stockData);
      } catch (error) {
        console.error("Error sending stock update:", error);
      }
    };

    sendUpdates();

    const intervalId = setInterval(sendUpdates, 5000);

    if (!isTradingHour()) {
      clearInterval(intervalId);
    }
  });

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

// Log WebSocket server status
httpServer.listen(process.env.SOCKET_PORT || 4000, () => {
  console.log(
    "WebSocket server is running and listening on port 🔌🔌🔌",
    httpServer.address().port
  );
});

app.get("/", (req, res) => {
  res.send('<h1>Trading API</h1><a href="/api-docs">Documentation</a>');
});

//SWAGGER API DOCS

const swaggerDocument = YAML.load(join(__dirname, "./docs/swagger.yaml"));
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

// ROUTES
app.use("/auth", authRouter);
app.use("/stocks", authenticateSocketUser, stockRouter);

// MIDDLEWARES
app.use(cors());
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// START SERVER

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
      console.log(`Server is listening on port ${PORT}....`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
