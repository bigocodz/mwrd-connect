import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    window.location.replace("/landing/index.html");
  }, []);
  return null;
};

export default Index;
