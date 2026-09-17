# Multi-stage Docker build for AuraMed Apache Flink Streaming Job
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# Apache Flink 1.19 Runtime Image
FROM apache/flink:1.19.0-java17

WORKDIR /opt/flink

# Copy built shaded JAR to Flink usrlib directory for automatic classloading
COPY --from=builder /build/target/auramed-streaming-job-1.0.0.jar /opt/flink/usrlib/auramed-streaming-job.jar

# Setup configuration overrides
RUN echo "taskmanager.numberOfTaskSlots: 4" >> /opt/flink/conf/flink-conf.yaml && \
    echo "state.backend: filesystem" >> /opt/flink/conf/flink-conf.yaml && \
    echo "state.checkpoints.dir: file:///opt/flink/checkpoints" >> /opt/flink/conf/flink-conf.yaml

USER flink

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["jobmanager"]
