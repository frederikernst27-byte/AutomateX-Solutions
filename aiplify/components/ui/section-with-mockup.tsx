"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

interface SectionWithMockupProps {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
  primaryImageSrc: string;
  secondaryImageSrc: string;
  reverseLayout?: boolean;
}

const SectionWithMockup: React.FC<SectionWithMockupProps> = ({
  title,
  description,
  primaryImageSrc,
  secondaryImageSrc,
  reverseLayout = false,
}) => {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut" },
    },
  };

  const layoutClasses = reverseLayout
    ? "md:grid-cols-2 md:grid-flow-col-dense"
    : "md:grid-cols-2";

  const textOrderClass = reverseLayout ? "md:col-start-2" : "";
  const imageOrderClass = reverseLayout ? "md:col-start-1" : "";

  return (
    <section className="relative overflow-hidden bg-black py-24 md:py-40">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_35%,rgba(96,165,250,0.09)_68%,rgba(255,255,255,0))]" />
      <div className="container relative z-10 mx-auto w-full max-w-[1220px] px-6 md:px-10">
        <motion.div
          className={`grid w-full grid-cols-1 items-center gap-16 md:gap-10 ${layoutClasses}`}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div
            className={`mx-auto mt-10 flex max-w-[546px] flex-col items-start gap-5 md:mx-0 md:mt-0 ${textOrderClass}`}
            variants={itemVariants}
          >
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-xl">
              Aiplify Operating Layer
            </div>
            <h2 className="text-3xl font-semibold leading-tight text-white md:text-[44px] md:leading-[1.08]">
              {title}
            </h2>
            <p className="text-sm leading-6 text-[#a1abb5] md:text-[15px]">
              {description}
            </p>
          </motion.div>

          <motion.div
            className={`relative mx-auto mt-10 w-full max-w-[300px] md:mt-0 md:max-w-[471px] ${imageOrderClass}`}
            variants={itemVariants}
          >
            <motion.div
              className="absolute z-0 h-[317px] w-[300px] overflow-hidden rounded-[28px] bg-[#090909] shadow-2xl ring-1 ring-white/10 md:h-[500px] md:w-[472px]"
              style={{
                top: reverseLayout ? "auto" : "10%",
                bottom: reverseLayout ? "10%" : "auto",
                left: reverseLayout ? "auto" : "-20%",
                right: reverseLayout ? "-20%" : "auto",
                transform: reverseLayout ? "translate(0, 0)" : "translateY(10%)",
                filter: "blur(1px)",
              }}
              initial={{ y: 0 }}
              whileInView={{ y: reverseLayout ? -20 : -30 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <div
                className="relative h-full w-full rounded-[28px] bg-cover bg-center opacity-80"
                style={{ backgroundImage: `url(${secondaryImageSrc})` }}
              />
            </motion.div>

            <motion.div
              className="relative z-10 h-[405px] w-full overflow-hidden rounded-[28px] bg-white/[0.06] shadow-[0_35px_120px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.12] backdrop-blur-[15px] md:h-[637px]"
              initial={{ y: 0 }}
              whileInView={{ y: reverseLayout ? 20 : 30 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${primaryImageSrc})` }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <div
        className="absolute bottom-0 left-0 z-0 h-px w-full"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
    </section>
  );
};

export default SectionWithMockup;
