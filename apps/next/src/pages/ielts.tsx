import dynamic from "next/dynamic";
import React from "react";

import { HeadSeo } from "@pno/components/head-seo";

import { PageWrapper } from "../common/page-wrapper";
import TopLoadingBar from "../common/top-loading-bar";
import { Loading } from "../components/loading";

const IeltsApp = dynamic(() => import("../modules/ielts/App"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function IeltsPage() {
  return (
    <>
      <HeadSeo title="IELTS 4-Skill Practice" />
      <TopLoadingBar />
      <IeltsApp />
    </>
  );
}

IeltsPage.PageWrapper = PageWrapper;
