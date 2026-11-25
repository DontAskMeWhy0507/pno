import dynamic from "next/dynamic";

import { HeadSeo } from "@pno/components/head-seo";

import { PageWrapper } from "../../common/page-wrapper";
import { getLayout } from "../../layouts/main-layout";

const InternalSet = dynamic(() => import("../../components/internal-set"));

const Set = () => {
  return (
    <>
      <HeadSeo title="Study Set" />
      <InternalSet />
    </>
  );
};

Set.PageWrapper = PageWrapper;
Set.getLayout = getLayout;

export default Set;
