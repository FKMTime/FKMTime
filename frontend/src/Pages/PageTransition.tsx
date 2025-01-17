import { motion } from "framer-motion";

const pageVariants = {
    initial: {
        opacity: 0,
        y: 50,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            type: "tween",
            ease: "easeOut",
            duration: 0.25,
        },
    },
    exit: {
        opacity: 0,
        y: -50,
        transition: {
            ease: "easeIn",
            duration: 0.15,
        },
    },
};

interface PageTransitionProps {
    children: React.ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
