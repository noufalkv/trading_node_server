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

// Configure CORS for Express app - MUST be before other middleware
const corsOptions = {
  origin: function(origin, callback) {
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ CORS: Development mode - allowing all origins. Origin: ${origin || 'none'}`);
      return callback(null, true);
    }
    
    // In production, check against whitelist
    if (!origin) {
      console.log('✅ CORS: No origin header (allowing - curl/mobile/tools)');
      return callback(null, true);
    }
    
    const allowedOrigins = process.env.WEBSERVER_URI 
      ? process.env.WEBSERVER_URI.split(',').map(url => url.trim()) 
      : [];
    
    console.log(`📍 CORS: Incoming origin: ${origin}`);
    console.log(`📍 CORS: Allowed origins: ${JSON.stringify(allowedOrigins)}`);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS: Allowed');
      callback(null, true);
    } else {
      console.log('❌ CORS: Denied');
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "access_token"],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json());

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: corsOptions,
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
httpServer.listen(process.env.SOCKET_PORT || 4000, '0.0.0.0', () => {
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

// Dynamically set the server URL based on the request
app.get("/api-docs/swagger.json", (req, res) => {
  const protocol = req.protocol;
  const host = req.get('host');
  const swaggerWithDynamicServer = {
    ...swaggerDocument,
    servers: [
      {
        url: `${protocol}://${host}`,
        description: 'Current server'
      }
    ]
  };
  res.json(swaggerWithDynamicServer);
});

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(null, {
  swaggerUrl: "/api-docs/swagger.json"
}));

// ROUTES
app.use("/auth", authRouter);
app.use("/stocks", authenticateSocketUser, stockRouter);

// MIDDLEWARES
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// START SERVER

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Server is listening on port ${PORT}....`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
