import { Router, type Request, type Response } from "express";
import eventRoutes from "./routes/eventRoutes";
import authRoutes from "./routes/authRoutes";
import taskRoutes from "./routes/taskRoutes";
import noteRoutes from "./routes/noteRoutes";
import budgetEntryRoutes from "./routes/budgetEntryRoutes";
import budgetRowDefRoutes from "./routes/budgetRowDefRoutes";

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
 *         content:
 *           application/json:
 *             example:
 *               - _id: "682250f706d4d7bb50fc7f91"
 *                 name: "Sali Bseso"
 *                 email: "sali@test.com"
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
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filter by owner user id
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: Filter by title text
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category text
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Filter by event color
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
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Get all kanban tasks
 *     description: Returns all task cards, optionally filtered by owner or status.
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filter by owner user id
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in-progress, done]
 *         description: Filter by task status
 *     responses:
 *       200:
 *         description: List of tasks
 *
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     description: Add a new kanban task card (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Task"
 *           example:
 *             title: "Prepare exam demo"
 *             description: "Record the kanban and notes walkthrough"
 *             status: "todo"
 *             priority: "high"
 *             owner: "test-user-1"
 *     responses:
 *       201:
 *         description: Task created
 *       401:
 *         description: Missing/invalid token
 */
router.use("/tasks", taskRoutes);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get one task
 *     description: Fetch a single task card by its MongoDB id.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task id
 *     responses:
 *       200:
 *         description: Task found
 *       404:
 *         description: Task not found
 *
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task
 *     description: Update an existing task card, including moving it between columns (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Task"
 *     responses:
 *       200:
 *         description: Task updated
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Task not found
 *
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     description: Remove a task card from the board (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task id
 *     responses:
 *       200:
 *         description: Task deleted
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /notes:
 *   get:
 *     tags: [Notes]
 *     summary: Get all notes
 *     description: Returns all personal notes, optionally filtered by owner or search query.
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filter by owner user id
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Case-insensitive search across title and content
 *     responses:
 *       200:
 *         description: List of notes
 *
 *   post:
 *     tags: [Notes]
 *     summary: Create a note
 *     description: Add a new personal note card (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Note"
 *           example:
 *             title: "Exam reflection"
 *             content: "Explain how each module is connected to the same authenticated user."
 *             tone: "violet"
 *             owner: "test-user-1"
 *     responses:
 *       201:
 *         description: Note created
 *       401:
 *         description: Missing/invalid token
 */
router.use("/notes", noteRoutes);

/**
 * @swagger
 * /notes/{id}:
 *   get:
 *     tags: [Notes]
 *     summary: Get one note
 *     description: Fetch a single note by its MongoDB id.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Note id
 *     responses:
 *       200:
 *         description: Note found
 *       404:
 *         description: Note not found
 *
 *   put:
 *     tags: [Notes]
 *     summary: Update a note
 *     description: Update an existing note card (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Note id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Note"
 *     responses:
 *       200:
 *         description: Note updated
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Note not found
 *
 *   delete:
 *     tags: [Notes]
 *     summary: Delete a note
 *     description: Remove a note card from the workspace (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Note id
 *     responses:
 *       200:
 *         description: Note deleted
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Note not found
 */

/**
 * @swagger
 * /budget-entries:
 *   get:
 *     tags: [Budget]
 *     summary: Get all budget entries
 *     description: Returns budget rows, optionally filtered by owner, month, or type.
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filter by owner user id
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: "2026-05"
 *         description: Filter by budget month in YYYY-MM format
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, fixed, variable, savings]
 *         description: Filter by budget section type
 *     responses:
 *       200:
 *         description: List of budget entries
 *
 *   post:
 *     tags: [Budget]
 *     summary: Create a budget entry
 *     description: Add a new budget row (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BudgetEntry"
 *           example:
 *             month: "2026-05"
 *             type: "income"
 *             category: "Salary"
 *             label: "Main salary"
 *             amount: 11193
 *             owner: "test-user-1"
 *     responses:
 *       201:
 *         description: Budget entry created
 *       401:
 *         description: Missing/invalid token
 */
router.use("/budget-entries", budgetEntryRoutes);

/**
 * @swagger
 * /budget-row-defs:
 *   get:
 *     tags: [Budget]
 *     summary: Get all budget row definitions
 *     description: Returns the user's budget row labels (income, fixed, variable, savings), optionally filtered by owner or type.
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Filter by owner user id
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, fixed, variable, savings]
 *         description: Filter by row type
 *     responses:
 *       200:
 *         description: List of budget row definitions
 *
 *   post:
 *     tags: [Budget]
 *     summary: Create a budget row definition
 *     description: Add a new labelled row to a budget section (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BudgetRowDef"
 *           example:
 *             label: "Main salary"
 *             type: "income"
 *             owner: "test-user-1"
 *     responses:
 *       201:
 *         description: Budget row definition created
 *       400:
 *         description: Validation error (label, type, or owner missing/invalid)
 *       401:
 *         description: Missing/invalid token
 */

/**
 * @swagger
 * /budget-row-defs/{id}:
 *   put:
 *     tags: [Budget]
 *     summary: Update a budget row definition
 *     description: Rename a row label or change its type (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Budget row definition id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BudgetRowDef"
 *     responses:
 *       200:
 *         description: Budget row definition updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Budget row definition not found
 *
 *   delete:
 *     tags: [Budget]
 *     summary: Delete a budget row definition
 *     description: Remove a row from a budget section (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Budget row definition id
 *     responses:
 *       200:
 *         description: Budget row definition deleted
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Budget row definition not found
 */
router.use("/budget-row-defs", budgetRowDefRoutes);

/**
 * @swagger
 * /budget-entries/{id}:
 *   get:
 *     tags: [Budget]
 *     summary: Get one budget entry
 *     description: Fetch a single budget entry by its MongoDB id.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Budget entry id
 *     responses:
 *       200:
 *         description: Budget entry found
 *       404:
 *         description: Budget entry not found
 *
 *   put:
 *     tags: [Budget]
 *     summary: Update a budget entry
 *     description: Update an existing budget row (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Budget entry id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BudgetEntry"
 *     responses:
 *       200:
 *         description: Budget entry updated
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Budget entry not found
 *
 *   delete:
 *     tags: [Budget]
 *     summary: Delete a budget entry
 *     description: Remove a budget row (requires login).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Budget entry id
 *     responses:
 *       200:
 *         description: Budget entry deleted
 *       401:
 *         description: Missing/invalid token
 *       404:
 *         description: Budget entry not found
 */

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
