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
      <HeadSeo title="Thi IELTS 4 Kỹ Năng" />
      <IeltsApp />
    </>
  );
}

IeltsPage.PageWrapper = PageWrapper;
