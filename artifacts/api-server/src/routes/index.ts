import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clinicsRouter from "./clinics";
import appointmentsRouter from "./appointments";
import faqsRouter from "./faqs";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";
import authRouter from "./auth";

const router: IRouter = Router();

// Public — auth + health + clinic info (used by chat widget)
router.use(authRouter);
router.use(healthRouter);
router.use(clinicsRouter);
router.use(chatRouter);

// Protected clinic admin routes (middleware applied per-route inside each file)
router.use(appointmentsRouter);
router.use(faqsRouter);
router.use(dashboardRouter);

export default router;
