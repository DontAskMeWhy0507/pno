import dynamic from "next/dynamic";
import React from "react";

import { HeadSeo } from "@quenti/components/head-seo";

import { PageWrapper } from "../common/page-wrapper";
import { Loading } from "../components/loading";

const IeltsApp = dynamic(() => import("../modules/ielts/App"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function IeltsPage() {
  return (
    <>
      <HeadSeo title="IELTS 4-Skill Practice" />
      <IeltsApp />
    </>
  );
}

IeltsPage.PageWrapper = PageWrapper;
