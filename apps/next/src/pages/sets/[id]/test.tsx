import { useSession } from "next-auth/react";
import { log } from "next-axiom";
import React from "react";

import { HeadSeo } from "@quenti/components/head-seo";
import { EvaluationResult, evaluate } from "@quenti/core/evaluator";
import { TestQuestionType, type WriteData } from "@quenti/interfaces";
import { api } from "@quenti/trpc";

import { Container } from "@chakra-ui/react";

import { EditorGlobalStyles } from "../../../common/editor-global-styles";
import { LazyWrapper } from "../../../common/lazy-wrapper";
import { PageWrapper } from "../../../common/page-wrapper";
import { AuthedPage } from "../../../components/authed-page";
import { ConfirmModal } from "../../../components/confirm-modal";
import { useSet } from "../../../hooks/use-set";
import { useSetFolderUnison } from "../../../hooks/use-set-folder-unison";
import { getLayout } from "../../../layouts/main-layout";
import { CreateTestData } from "../../../modules/create-test-data";
import HydrateSetData from "../../../modules/hydrate-set-data";
import { LoadingView } from "../../../modules/test/loading-view";
import { ResultsView } from "../../../modules/test/results-view";
import { TestLoading } from "../../../modules/test/test-loading";
import { TestView } from "../../../modules/test/test-view";
import { TestContext, useTestContext } from "../../../stores/use-test-store";

const Test = () => {
  return (
    <AuthedPage>
      <HeadSeo title="Test" />
      <LazyWrapper>
        <EditorGlobalStyles />
        <HydrateSetData
          disallowDirty
          withDistractors
          placeholder={<TestLoading />}
        >
          <SeoWrapper>
            <CreateTestData>
              <TestContainer />
            </CreateTestData>
          </SeoWrapper>
        </HydrateSetData>
      </LazyWrapper>
    </AuthedPage>
  );
};

const SeoWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { title } = useSetFolderUnison();

  return (
    <>
      <HeadSeo title={`Test: ${title}`} />
      {children}
    </>
  );
};

const TestContainer = () => {
  const session = useSession();
  const { id } = useSet();
  const store = React.useContext(TestContext)!;
  const result = useTestContext((s) => s.result);
  const setEndedAt = useTestContext((s) => s.setEndedAt);
  const submit = useTestContext((s) => s.submit);
  const finalRef = React.useRef(null);

  const [hasUnansweredOpen, setHasUnansweredOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const submitTimeoutRef = React.useRef<number | null>(null);
  const submittingRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (submitTimeoutRef.current !== null) {
        window.clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  const bulkGrade = api.cortex.bulkGrade.useMutation({
    onSuccess: (data) => {
      const endedAt = store.getState().endedAt?.getTime() ?? Date.now();
      stateSubmit(data, Date.now() - endedAt);
    },
    onError: () => {
      // Fall back to deterministic local grading instead of hanging on LoadingView
      const endedAt = store.getState().endedAt?.getTime() ?? Date.now();
      stateSubmit([], Date.now() - endedAt);
    },
    retry: (count) => count <= 2,
  });

  const stateSubmit = (
    cortexGraded: Parameters<typeof submit>[0] = [],
    apiElapsedMs: number,
  ) => {
    const doSubmit = () => {
      submit(cortexGraded);
      setLoading(false);
      submittingRef.current = false;
    };

    if (apiElapsedMs > 2000) doSubmit();
    else
      submitTimeoutRef.current = window.setTimeout(
        doSubmit,
        Math.max(
          0,
          Math.floor(Math.random() * 2000) + 2000 - Math.min(1000, apiElapsedMs),
        ),
      );
  };

  const checkAllAnswered = () => {
    return store.getState().timeline.every((question) => question.answered);
  };
  const getCortexEligible = () => {
    const state = store.getState();

    return state.timeline
      .map((question, index) => ({ ...question, index }))
      .filter((question) => {
        if (question.type !== TestQuestionType.Write) return false;
        if (!question.answered || !question.data.answer) return false;

        const data = question.data as WriteData;
        const original =
          question.answerMode == "Definition"
            ? data.term.definition
            : data.term.word;
        if (original.split(" ").length < 3) return false;

        // Pre-evaluate the question to see if it's already correct and we can skip an api call
        if (
          evaluate(
            question.answerMode == "Definition"
              ? state.definitionLanguage
              : state.wordLanguage,
            "One",
            data.answer || "",
            question.answerMode == "Definition"
              ? data.term.definition
              : data.term.word,
          ) == EvaluationResult.Correct
        )
          return false;

        return true;
      })
      .map((question) => {
        const data = question.data as WriteData;
        return {
          index: question.index,
          answer:
            question.answerMode == "Word"
              ? data.term.word
              : data.term.definition,
          input: data.answer!,
        };
      });
  };

  const scrollToFirstUnanswered = () => {
    const firstUnanswered = store
      .getState()
      .timeline.findIndex((question) => !question.answered);
    if (firstUnanswered == -1) return;

    const elem = document.getElementById(`test-card-${firstUnanswered}`);
    if (!elem) return;

    const position = elem.getBoundingClientRect();
    window.scrollTo({
      left: position.left,
      top: position.top + window.scrollY - 48,
      behavior: "smooth",
    });
  };

  const onSubmit = (bypass = false) => {
    if (submittingRef.current || loading) return;
    if (!checkAllAnswered() && !bypass) {
      setHasUnansweredOpen(true);
      return;
    }

    submittingRef.current = true;
    setHasUnansweredOpen(false);
    setEndedAt(new Date());
    setLoading(true);

    const cortexEligible = getCortexEligible();
    if (!cortexEligible.length) stateSubmit([], 0);
    else {
      bulkGrade.mutate({ answers: cortexEligible });
    }
  };

  React.useEffect(() => {
    log.info("test.identify", {
      userId: session.data?.user?.id,
      studySetId: id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthedPage>
      <ConfirmModal
        isOpen={hasUnansweredOpen}
        onClose={() => setHasUnansweredOpen(false)}
        actionText="Review questions"
        cancelText="Submit anyway"
        heading="Some questions are unanswered"
        body="Do you want to review your unanswered questions or submit the test now?"
        onCancel={() => {
          void onSubmit(true);
        }}
        onConfirm={() => {
          setHasUnansweredOpen(false);
          scrollToFirstUnanswered();
        }}
        finalFocusRef={finalRef}
      />
      {loading ? (
        <LoadingView />
      ) : (
        <Container maxW="4xl" mt={{ base: 0, md: 10 }}>
          {result ? (
            <ResultsView />
          ) : (
            <TestView
              onSubmit={() => {
                void onSubmit();
              }}
            />
          )}
        </Container>
      )}
    </AuthedPage>
  );
};

Test.PageWrapper = PageWrapper;
Test.getLayout = getLayout;

export default Test;
