import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  addCardHandler,
  deleteCardHandler,
  updateCardHandler,
} from "./card-mutations.handler";
import {
  ZAddAnkiCardSchema,
  ZDeleteAnkiCardSchema,
  ZUpdateAnkiCardSchema,
} from "./card-mutations.schema";
import {
  createDeckHandler,
  updateDeckHandler,
  updateTemplateHandler,
} from "./deck-mutations.handler";
import {
  ZCreateAnkiDeckSchema,
  ZUpdateAnkiDeckSchema,
  ZUpdateAnkiTemplateSchema,
} from "./deck-mutations.schema";
import { getReviewQueueHandler } from "./get-review-queue.handler";
import { ZGetReviewQueueSchema } from "./get-review-queue.schema";
import { importFromDriveHandler } from "./import-from-drive.handler";
import { ZImportFromDriveSchema } from "./import-from-drive.schema";
import { importPackageHandler } from "./import-package.handler";
import { ZImportPackageSchema } from "./import-package.schema";
import { listDriveDecksHandler } from "./list-drive-decks.handler";
import { ZListDriveDecksSchema } from "./list-drive-decks.schema";
import { submitReviewHandler } from "./submit-review.handler";
import { ZSubmitReviewSchema } from "./submit-review.schema";

export const ankiRouter = createTRPCRouter({
  getReviewQueue: protectedProcedure
    .input(ZGetReviewQueueSchema)
    .query(async ({ ctx, input }) => {
      return getReviewQueueHandler({ ctx, input });
    }),

  submitReview: protectedProcedure
    .input(ZSubmitReviewSchema)
    .mutation(async ({ ctx, input }) => {
      return submitReviewHandler({ ctx, input });
    }),

  importPackage: protectedProcedure
    .input(ZImportPackageSchema)
    .mutation(async ({ ctx, input }) => {
      return importPackageHandler({ ctx, input });
    }),

  listDriveDecks: protectedProcedure
    .input(ZListDriveDecksSchema)
    .query(async ({ ctx, input }) => {
      return listDriveDecksHandler({ ctx, input });
    }),

  importFromDrive: protectedProcedure
    .input(ZImportFromDriveSchema)
    .mutation(async ({ ctx, input }) => {
      return importFromDriveHandler({ ctx, input });
    }),

  createDeck: protectedProcedure
    .input(ZCreateAnkiDeckSchema)
    .mutation(async ({ ctx, input }) => {
      return createDeckHandler({ ctx, input });
    }),

  updateDeck: protectedProcedure
    .input(ZUpdateAnkiDeckSchema)
    .mutation(async ({ ctx, input }) => {
      return updateDeckHandler({ ctx, input });
    }),

  updateTemplate: protectedProcedure
    .input(ZUpdateAnkiTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return updateTemplateHandler({ ctx, input });
    }),

  addCard: protectedProcedure
    .input(ZAddAnkiCardSchema)
    .mutation(async ({ ctx, input }) => {
      return addCardHandler({ ctx, input });
    }),

  updateCard: protectedProcedure
    .input(ZUpdateAnkiCardSchema)
    .mutation(async ({ ctx, input }) => {
      return updateCardHandler({ ctx, input });
    }),

  deleteCard: protectedProcedure
    .input(ZDeleteAnkiCardSchema)
    .mutation(async ({ ctx, input }) => {
      return deleteCardHandler({ ctx, input });
    }),
});

export default ankiRouter;
