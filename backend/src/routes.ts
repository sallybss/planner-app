import { Router, type Request, type Response } from "express";
import eventRoutes from "./routes/eventRoutes";
import authRoutes from "./routes/authRoutes";

const router: Router = Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags: [System]
 *     summary: API status
 *     description: Quick check that the Planner Events API is alive.
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             example:
 *               message: Welcome to the planner-events API
 */
router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the planner-events API" });
});

/**
 * @swagger
 * /auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: Get all users
 *     description: Returns all registered users without their passwords.
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account
 *     description: Register a new user so you can use protected endpoints.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/User"
 *           example:
 *             name: "Sali Bseso"
 *             email: "sali@test.com"
 *             password: "123456"
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 */
router.use("/auth", authRoutes);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in
 *     description: Authenticate an existing user and return a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *           example:
 *             email: "sali@test.com"
 *             password: "123456"
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials or validation error
 *       500:
 *         description: Missing token secret or server error
 */

/**
 * @swagger
 * /events:
 *   get:
 *     tags: [Events]
 *     summary: Get all events
 *     description: Returns all planner events.
 *     responses:
 *       200:
 *         description: List of events
 *
 *   post:
 *     tags: [Events]
 *     summary: Add an event
 *     description: Add a new planner event (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Event"
 *           example:
 *             title: "Study session"
 *             description: "Prepare for DE presentation"
 *             date: "2026-03-12T10:00:00.000Z"
 *             startTime: "10:00"
 *             endTime: "12:00"
 *             color: "#7cc6fe"
 *             category: "School"
 *             owner: "test-user-1"
 *     responses:
 *       201:
 *         description: Event created
 *       401:
 *         description: Missing/invalid token
 */
router.use("/events", eventRoutes);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Get one event
 *     description: Fetch a single event by its MongoDB id.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event id
 *     responses:
 *       200:
 *         description: Event found
 *       404:
 *         description: Event not found
 *
 *   put:
 *     tags: [Events]
 *     summary: Update an event
 *     description: Update an existing event (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Event"
 *     responses:
 *       200:
 *         description: Event updated
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Event not found
 *
 *   delete:
 *     tags: [Events]
 *     summary: Delete an event
 *     description: Remove an event from the planner (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event id
 *     responses:
 *       200:
 *         description: Event deleted
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Event not found
 */

export default router;
