import { HeadSeo } from "@pno/components/head-seo";

import { EditorGlobalStyles } from "../../../common/editor-global-styles";
import { LazyWrapper } from "../../../common/lazy-wrapper";
import { PageWrapper } from "../../../common/page-wrapper";
import { AuthedPage } from "../../../components/authed-page";
import { getLayout } from "../../../layouts/main-layout";
import { GravityContainer } from "../../../modules/gravity/gravity-container";
import { HydrateSetData } from "../../../modules/hydrate-set-data";

const GravityPage = () => {
  return (
    <AuthedPage>
      <HeadSeo title="Gravity" />
      <LazyWrapper>
        <EditorGlobalStyles small />
        <HydrateSetData disallowDirty>
          <GravityContainer />
        </HydrateSetData>
      </LazyWrapper>
    </AuthedPage>
  );
};

GravityPage.PageWrapper = PageWrapper;
GravityPage.getLayout = getLayout;

export default GravityPage;
