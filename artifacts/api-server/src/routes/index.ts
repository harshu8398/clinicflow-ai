import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clinicsRouter from "./clinics";
import appointmentsRouter from "./appointments";
import faqsRouter from "./faqs";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clinicsRouter);
router.use(appointmentsRouter);
router.use(faqsRouter);
router.use(dashboardRouter);
router.use(chatRouter);

export default router;
