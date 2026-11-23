import { HeadSeo } from "@quenti/components/head-seo";

import { EditorGlobalStyles } from "../../../common/editor-global-styles";
import { LazyWrapper } from "../../../common/lazy-wrapper";
import { PageWrapper } from "../../../common/page-wrapper";
import { AuthedPage } from "../../../components/authed-page";
import { getLayout } from "../../../layouts/main-layout";
import { CrosswordContainer } from "../../../modules/crossword/crossword-container";
import { HydrateSetData } from "../../../modules/hydrate-set-data";

const CrosswordPage = () => {
  return (
    <AuthedPage>
      <HeadSeo title="Crossword" />
      <LazyWrapper>
        <EditorGlobalStyles small />
        <HydrateSetData disallowDirty>
          <CrosswordContainer />
        </HydrateSetData>
      </LazyWrapper>
    </AuthedPage>
  );
};

CrosswordPage.PageWrapper = PageWrapper;
CrosswordPage.getLayout = getLayout;

export default CrosswordPage;
