import type { GetServerSideProps } from "next";

export default function Signup() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/home",
    permanent: false,
  },
});
