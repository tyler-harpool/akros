FROM node:20-bullseye

# Set the working directory
WORKDIR /workspaces/app

# Add user node to sudoers
RUN apt-get update \
    && apt-get install -y sudo \
    && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

# Install additional tools for development
RUN apt-get update && apt-get install -y \
    curl \
    git \
    vim \
    jq \
    less \
    # Cleanup to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=development

# Set up non-root user
USER node

# Add global node packages if needed
RUN npm install -g nodemon

# The command below will run when the container starts
CMD ["sleep", "infinity"]
