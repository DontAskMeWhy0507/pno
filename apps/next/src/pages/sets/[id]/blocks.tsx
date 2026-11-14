import { HeadSeo } from "@quenti/components/head-seo";

import { EditorGlobalStyles } from "../../../common/editor-global-styles";
import { LazyWrapper } from "../../../common/lazy-wrapper";
import { PageWrapper } from "../../../common/page-wrapper";
import { AuthedPage } from "../../../components/authed-page";
import { getLayout } from "../../../layouts/main-layout";
import { BlocksContainer } from "../../../modules/blocks/blocks-container";
import { HydrateSetData } from "../../../modules/hydrate-set-data";

const BlocksPage = () => {
  return (
    <AuthedPage>
      <HeadSeo title="Blocks Game" />
      <LazyWrapper>
        <EditorGlobalStyles small />
        <HydrateSetData disallowDirty>
          <BlocksContainer />
        </HydrateSetData>
      </LazyWrapper>
    </AuthedPage>
  );
};

BlocksPage.PageWrapper = PageWrapper;
BlocksPage.getLayout = getLayout;

export default BlocksPage;
